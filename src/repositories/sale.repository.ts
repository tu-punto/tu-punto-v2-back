import { VentaModel } from "../entities/implements/VentaSchema";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { IVenta } from "../entities/IVenta";
import { IVentaDocument } from "../entities/documents/IVentaDocument";
import { Types } from 'mongoose';
import { applySellerCommissionCap } from "../utils/commissionCap";

const resolveSaleCommissionConfig = async (sale: IVenta) => {
  const vendedor = await VendedorModel.findById(sale.id_vendedor || sale.vendedor)
    .select("comision_porcentual comision_fija comision_diferente_por_sucursal pago_sucursales")
    .lean();

  const totalVenta = Number(sale.precio_unitario || 0) * Number(sale.cantidad || 1);
  const branchId = String((sale as any)?.sucursal || "").trim();
  const useBranchCommission = Boolean((vendedor as any)?.comision_diferente_por_sucursal);

  if (vendedor && useBranchCommission && branchId) {
    const branch = Array.isArray((vendedor as any)?.pago_sucursales)
      ? (vendedor as any).pago_sucursales.find((payment: any) =>
          String(payment?.id_sucursal?._id || payment?.id_sucursal || "").trim() === branchId
        )
      : null;

    const percent = Number(branch?.comision_porcentual ?? 0);
    const fixed = Number(branch?.comision_fija ?? 0);
    return { comision: totalVenta * (percent / 100) + fixed };
  }

  const percent = Number((vendedor as any)?.comision_porcentual ?? 0);
  const fixed = Number((vendedor as any)?.comision_fija ?? 0);
  return { comision: totalVenta * (percent / 100) + fixed };
};


const findAll = async (): Promise<IVentaDocument[]> => {
  return await VentaModel.find().populate(['producto', 'pedido', 'vendedor']).lean().exec();
};


const findByPedidoDateRange = async (
  from?: Date,
  to?: Date,
  sucursalIds?: string[]
): Promise<IVentaDocument[]> => {
  const validSucursalIds = (sucursalIds || []).filter((id) => Types.ObjectId.isValid(id));

  if (!from && !to && !validSucursalIds.length) {
    return await findAll();
  }

  const pedidoMatch: any = {};
  if (from || to) {
    pedidoMatch.fecha_pedido = {};
    if (from) pedidoMatch.fecha_pedido.$gte = from;
    if (to) pedidoMatch.fecha_pedido.$lte = to;
  }

  const ventaMatch: any = {};

  if (validSucursalIds.length) {
    ventaMatch.sucursal = { $in: validSucursalIds.map((id) => new Types.ObjectId(id)) };
  }

  if (from || to) {
    const pedidos = await PedidoModel.find(pedidoMatch).select('_id').lean().exec();
    const pedidoIds = pedidos.map((p: any) => p._id);
    if (pedidoIds.length === 0) return [];
    ventaMatch.pedido = { $in: pedidoIds };
  }

  return await VentaModel.find(ventaMatch)
    .populate(['producto', 'pedido', 'vendedor'])
    .lean()
    .exec();
};


const registerSale = async (sale: IVenta): Promise<IVentaDocument> => {
  if (sale.sucursal && typeof sale.sucursal === 'string') {
    sale.sucursal = new Types.ObjectId(sale.sucursal);
  }

  const { comision } = await resolveSaleCommissionConfig(sale);
  sale.comision = applySellerCommissionCap(sale.id_vendedor || sale.vendedor, comision);

  const newSale = new VentaModel(sale);
  const saved = await newSale.save();
  return saved;
};


const findById = async (saleId: string) => {
  return await VentaModel.findOne({ _id: saleId }).populate(['producto', 'pedido', 'vendedor']);
};

const updateSale = async (sale: IVenta) => {
  return await VentaModel.findByIdAndUpdate(sale._id, sale, { new: true });
};


const findByPedidoId = async (pedidoId: any) => {
  return await VentaModel.find({ pedido: new Types.ObjectId(pedidoId) }).populate(['producto']);
};

const findByProductId = async (productId: number) => {
  return await VentaModel.find({ producto: productId }).populate(['producto', 'pedido', 'vendedor']);
};

const findBySellerId = async (sellerId: string) => {
  return await VentaModel.find({ vendedor: sellerId }).populate(['producto', 'pedido']);
};

const updateProducts = async (_: any, prods: any[]): Promise<any[]> => {
  const updatedSales: any[] = [];

  for (const prod of prods) {
    const fieldsToUpdate: any = {};
    if ('cantidad' in prod) fieldsToUpdate.cantidad = prod.cantidad;
    if ('precio_unitario' in prod) fieldsToUpdate.precio_unitario = prod.precio_unitario;
    if ('precio_original' in prod) fieldsToUpdate.precio_original = prod.precio_original;
    if ('utilidad' in prod) fieldsToUpdate.utilidad = prod.utilidad;
    if ('quien_paga_delivery' in prod) fieldsToUpdate.quien_paga_delivery = prod.quien_paga_delivery;
    //console.log("📝 Updating venta ID:", prod._id || prod.id_venta);
    //console.log("🧾 Campos a actualizar:", fieldsToUpdate);

    const updated = await VentaModel.findByIdAndUpdate(
      prod._id || prod.id_venta,
      { $set: fieldsToUpdate },
      { new: true }
    );
    if (updated) {
      //console.log("✅ Venta actualizada:", updated._id);
    } else {
      console.warn("⚠️ No se encontró la venta para actualizar:", prod._id || prod.id_venta);
    }


    if (updated) updatedSales.push(updated);
  }

  return updatedSales;
};

const updateSalesOfProducts = async (salesData: any[]): Promise<any[]> => {
  const updated: any[] = [];

  for (const sale of salesData) {
    const updatedSale = await VentaModel.findOneAndUpdate(
      { _id: sale._id },
      {
        cantidad: sale.cantidad,
        precio_unitario: sale.precio_unitario,
        precio_original: sale.precio_original,
      },
      { new: true }
    );
    updated.push(updatedSale);
  }

  return updated;
};

const deleteSalesOfProducts = async (salesData: any[]): Promise<any[]> => {
  const ids = salesData.map(s => s._id);
  await VentaModel.deleteMany({ _id: { $in: ids } });
  return ids;
};

const deleteProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const deletedProducts: any[] = [];
  const keys = new Set(prods.map(p => `${p._id}-${p._id}`));

  for (const sale of sales) {
    const key = `${sale._id}-${sale.producto._id}`;
    if (keys.has(key)) {
      await VentaModel.deleteOne({
        _id: sale._id,
        producto: sale.producto._id,
      });
      deletedProducts.push({ _id: sale._id, id_producto: sale.producto._id });
    }
  }

  return deletedProducts;
};

const deleteSalesByIds = async (saleIds: number[]): Promise<any> => {
  await VentaModel.deleteMany({ _id: { $in: saleIds } });
};

const getDataPaymentProof = async (sellerId: number) => {
  return await VentaModel.find({
    deposito_realizado: false,
    vendedor: sellerId
  }).populate(['producto', 'pedido']);
};

const deleteSaleById = async (id: string) => {
  const res = await VentaModel.deleteOne({ _id: id });
  return res.deletedCount > 0;
};

async function recalcularComisiones() {
  const ventas = await VentaModel.find();
  for (const venta of ventas) {
    if (Object.prototype.hasOwnProperty.call(venta.toObject(), "comision")) {
      continue;
    }

    const { comision } = await resolveSaleCommissionConfig(venta as unknown as IVenta);
    venta.comision = applySellerCommissionCap(venta.id_vendedor || venta.vendedor, comision);
    await venta.save();
  }
  console.log("Comisiones recalculadas y guardadas.");
}

export const SaleRepository = {
  findAll,
  findByPedidoDateRange,
  registerSale,
  findByPedidoId,
  findByProductId,
  updateSalesOfProducts,
  updateProducts,
  deleteProducts,
  findBySellerId,
  findById,
  updateSale,
  deleteSalesByIds,
  getDataPaymentProof,
  deleteSalesOfProducts,
  deleteSaleById,
  recalcularComisiones
};

