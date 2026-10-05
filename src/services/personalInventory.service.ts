import {
  PersonalExpenseModel,
  PersonalInventoryMovementModel,
  PersonalProductModel,
  PersonalSaleModel,
  isObjectId,
} from "../entities/implements/PersonalInventorySchemas";

const money = (value: unknown) => Math.round(Number(value) * 100) / 100;
const validMoney = (value: unknown, allowZero = true) => Number.isFinite(Number(value)) && (allowZero ? Number(value) >= 0 : Number(value) > 0);
const cleanName = (value: unknown) => String(value || "").trim();

export const PersonalInventoryService = {
  async listProducts(sellerId: string, q?: string) {
    const filter: any = { sellerId };
    if (cleanName(q)) filter.name = { $regex: cleanName(q), $options: "i" };
    return PersonalProductModel.find(filter).sort({ name: 1 }).lean();
  },

  async createProduct(sellerId: string, input: any) {
    const name = cleanName(input.name);
    if (!name || !validMoney(input.salePrice) || !validMoney(input.stock)) throw new Error("Datos de producto invalidos");
    if (input.purchaseCost !== undefined && input.purchaseCost !== null && !validMoney(input.purchaseCost)) throw new Error("Costo de compra invalido");
    const product = await PersonalProductModel.create({ sellerId, name, salePrice: money(input.salePrice), purchaseCost: input.purchaseCost == null ? undefined : money(input.purchaseCost), stock: Number(input.stock) });
    if (product.stock > 0) await PersonalInventoryMovementModel.create({ sellerId, productId: product._id, type: "initial", quantityDelta: product.stock, reason: "Stock inicial" });
    return product;
  },

  async updateProduct(sellerId: string, id: string, input: any) {
    if (!isObjectId(id)) throw new Error("Producto no encontrado");
    const update: any = {};
    if (input.name !== undefined) { const name = cleanName(input.name); if (!name) throw new Error("Nombre requerido"); update.name = name; }
    if (input.salePrice !== undefined) { if (!validMoney(input.salePrice)) throw new Error("Precio invalido"); update.salePrice = money(input.salePrice); }
    if (input.purchaseCost !== undefined) { if (input.purchaseCost === null || input.purchaseCost === "") update.purchaseCost = undefined; else if (!validMoney(input.purchaseCost)) throw new Error("Costo invalido"); else update.purchaseCost = money(input.purchaseCost); }
    const product = await PersonalProductModel.findOneAndUpdate({ _id: id, sellerId }, { $set: update }, { new: true });
    if (!product) throw new Error("Producto no encontrado");
    return product;
  },

  async adjustStock(sellerId: string, id: string, input: any) {
    const delta = Number(input.quantityDelta);
    const reason = cleanName(input.reason);
    if (!isObjectId(id) || !Number.isInteger(delta) || !delta || !reason) throw new Error("Ajuste de stock invalido");
    const product = await PersonalProductModel.findOneAndUpdate({ _id: id, sellerId, ...(delta < 0 ? { stock: { $gte: -delta } } : {}) }, { $inc: { stock: delta } }, { new: true });
    if (!product) throw new Error("Stock insuficiente o producto no encontrado");
    await PersonalInventoryMovementModel.create({ sellerId, productId: id, type: "adjustment", quantityDelta: delta, reason });
    return product;
  },

  async createExpense(sellerId: string, input: any) {
    const amount = money(input.amount), description = cleanName(input.description);
    if (!validMoney(amount, false) || !description) throw new Error("Gasto invalido");
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new Error("Fecha invalida");
    return PersonalExpenseModel.create({ sellerId, amount, description, occurredAt });
  },

  async createSale(sellerId: string, input: any) {
    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (!rawItems.length) throw new Error("Agrega al menos un producto");
    const quantities = new Map<string, number>();
    for (const row of rawItems) {
      const id = String(row?.productId || ""), quantity = Number(row?.quantity);
      if (!isObjectId(id) || !Number.isInteger(quantity) || quantity < 1) throw new Error("Linea de venta invalida");
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    const decremented: Array<{ productId: string; quantity: number }> = [];
    let createdSale: any = null;
    try {
      const items: any[] = [];
      for (const [productId, quantity] of quantities) {
        // La condicion stock >= quantity conserva el limite aun en Mongo standalone.
        const product = await PersonalProductModel.findOneAndUpdate({ _id: productId, sellerId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { new: true });
        if (!product) throw new Error("Stock insuficiente o producto no encontrado");
        decremented.push({ productId, quantity });
        items.push({ productId: product._id, name: product.name, quantity, unitPrice: product.salePrice, subtotal: money(product.salePrice * quantity) });
      }
      createdSale = await PersonalSaleModel.create({ sellerId, items, total: money(items.reduce((sum, item) => sum + item.subtotal, 0)) });
      await PersonalInventoryMovementModel.insertMany(items.map((item) => ({ sellerId, productId: item.productId, type: "sale", quantityDelta: -item.quantity, reason: "Venta personal", saleId: createdSale._id })));
      return createdSale;
    } catch (error) {
      if (createdSale?._id) await PersonalSaleModel.deleteOne({ _id: createdSale._id, sellerId });
      await Promise.all(decremented.map(({ productId, quantity }) => PersonalProductModel.updateOne({ _id: productId, sellerId }, { $inc: { stock: quantity } })));
      throw error;
    }
  },

  async history(sellerId: string, query: any) {
    const type = cleanName(query.type), from = query.from ? new Date(query.from) : null, to = query.to ? new Date(query.to) : null;
    const dates: any = {}; if (from && !Number.isNaN(from.getTime())) dates.$gte = from; if (to && !Number.isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); dates.$lte = to; }
    const productId = cleanName(query.productId);
    const [sales, expenses, movements] = await Promise.all([
      (!type || type === "sale" ? PersonalSaleModel.find({ sellerId, ...(productId && isObjectId(productId) ? { "items.productId": productId } : {}), ...(Object.keys(dates).length ? { createdAt: dates } : {}) }).lean() : []),
      (!type || type === "expense" ? PersonalExpenseModel.find({ sellerId, ...(Object.keys(dates).length ? { occurredAt: dates } : {}) }).lean() : []),
      (!type || type === "adjustment" || type === "movement" ? PersonalInventoryMovementModel.find({ sellerId, ...(productId && isObjectId(productId) ? { productId } : {}), ...(Object.keys(dates).length ? { createdAt: dates } : {}) }).populate("productId", "name").lean() : []),
    ]);
    return [
      ...sales.map((row: any) => ({ id: String(row._id), type: "sale", occurredAt: row.createdAt, total: row.total, items: row.items })),
      ...expenses.map((row: any) => ({ id: String(row._id), type: "expense", occurredAt: row.occurredAt, amount: row.amount, description: row.description })),
      ...movements.map((row: any) => ({ id: String(row._id), type: "adjustment", occurredAt: row.createdAt, quantityDelta: row.quantityDelta, reason: row.reason, product: row.productId })),
    ].sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  },
};
