import { Types } from "mongoose";
import { IngresoModel } from "../entities/implements/IngresoSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { StockWithdrawalRequestModel } from "../entities/implements/StockWithdrawalRequestSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";

const toObjectId = (value: unknown, label: string) => {
  const id = String(value || "").trim();
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${label} invalido`);
  }
  return new Types.ObjectId(id);
};

const normalizeVariants = (value: any): Record<string, string> => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === "function") return value.toObject();
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item ?? "")])
  );
};

const variantsEqual = (a: Record<string, string>, b: Record<string, string>) => {
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => String(a[key] || "") === String(b[key] || ""));
};

const getVariantFullLabel = (variants: Record<string, string>) => {
  const label = Object.values(variants)
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" / ");
  return label ? ` - ${label}` : "";
};

const findBranchAndCombination = (product: any, branchId: string, item: any) => {
  const branch = (product.sucursales || []).find((candidate: any) => {
    const id = candidate?.id_sucursal?._id || candidate?.id_sucursal;
    return String(id) === String(branchId);
  });
  if (!branch) {
    throw new Error(`El producto ${product.nombre_producto} no esta en la sucursal seleccionada`);
  }

  const targetVariantKey = String(item?.variantKey || "").trim();
  const targetVariants = normalizeVariants(item?.variantes);
  const combination = (branch.combinaciones || []).find((candidate: any) => {
    if (targetVariantKey && String(candidate?.variantKey || "") === targetVariantKey) return true;
    return variantsEqual(normalizeVariants(candidate?.variantes), targetVariants);
  });

  if (!combination) {
    throw new Error(`No se encontro la variante de ${product.nombre_producto}`);
  }

  return { branch, combination };
};

const buildDto = (request: any) => {
  const row = request?.toObject?.() || request;
  return {
    ...row,
    _id: String(row?._id || ""),
    seller: row?.seller,
    branch: row?.branch,
    items: (row?.items || []).map((item: any) => ({
      ...item,
      product: String(item?.product?._id || item?.product || ""),
      variantes: normalizeVariants(item?.variantes),
    })),
  };
};

const listRequests = async (params: {
  role: string;
  sellerId?: string;
  branchId?: string;
  status?: string;
}) => {
  const filter: any = {};
  if (params.status && params.status !== "all") filter.status = params.status;
  if (params.role === "seller") {
    filter.seller = toObjectId(params.sellerId, "Vendedor");
  }
  if (params.branchId && Types.ObjectId.isValid(params.branchId)) {
    filter.branch = new Types.ObjectId(params.branchId);
  }

  const rows = await StockWithdrawalRequestModel.find(filter)
    .populate("seller", "nombre apellido marca mail telefono")
    .populate("branch", "nombre")
    .sort({ createdAt: -1 })
    .lean();
  return rows.map(buildDto);
};

const createRequest = async (params: {
  sellerId: string;
  userId?: string;
  branchId: string;
  items: any[];
  comment?: string;
}) => {
  const sellerId = toObjectId(params.sellerId, "Vendedor");
  const branchId = toObjectId(params.branchId, "Sucursal");
  const seller = await VendedorModel.findById(sellerId).lean();
  if (!seller) throw new Error("Vendedor no encontrado");

  const sellerBranch = (seller.pago_sucursales || []).find((branch: any) => {
    const id = branch?.id_sucursal?._id || branch?.id_sucursal;
    return String(id) === String(branchId);
  });
  if (!sellerBranch) throw new Error("La sucursal no esta habilitada para este vendedor");

  const normalizedItems = [];
  for (const rawItem of params.items || []) {
    const productId = toObjectId(rawItem?.productId || rawItem?.product, "Producto");
    const quantity = Math.floor(Number(rawItem?.quantity || 0));
    if (quantity <= 0) continue;

    const product = await ProductoModel.findOne({ _id: productId, id_vendedor: sellerId });
    if (!product) throw new Error("Producto no encontrado para este vendedor");

    const { combination } = findBranchAndCombination(product, String(branchId), rawItem);
    const currentStock = Number(combination?.stock || 0);
    if (quantity > currentStock) {
      throw new Error(`${product.nombre_producto} no tiene stock suficiente`);
    }

    const variants = normalizeVariants(combination.variantes || rawItem?.variantes);
    normalizedItems.push({
      product: product._id,
      productName: product.nombre_producto,
      variantKey: String(combination?.variantKey || rawItem?.variantKey || ""),
      variantLabel:
        String(rawItem?.variantLabel || "").trim() || getVariantFullLabel(variants).replace(/^ - /, ""),
      variantes: variants,
      quantity,
      stockAtRequest: currentStock,
    });
  }

  if (!normalizedItems.length) {
    throw new Error("Selecciona al menos un producto con cantidad mayor a cero");
  }

  const request = await StockWithdrawalRequestModel.create({
    seller: sellerId,
    branch: branchId,
    requestedBy: params.userId && Types.ObjectId.isValid(params.userId) ? new Types.ObjectId(params.userId) : undefined,
    comment: String(params.comment || "").trim(),
    items: normalizedItems,
  });

  return buildDto(request);
};

const approveRequest = async (params: { requestId: string; userId?: string }) => {
  const request = await StockWithdrawalRequestModel.findById(params.requestId);
  if (!request) throw new Error("Solicitud no encontrada");
  if (request.status !== "pending") throw new Error("La solicitud ya fue procesada");

  const branchId = String(request.branch);
  for (const item of request.items as any[]) {
    const product = await ProductoModel.findById(item.product);
    if (!product) throw new Error(`Producto no encontrado: ${item.productName}`);

    const { combination } = findBranchAndCombination(product, branchId, item);
    const quantity = Math.floor(Number(item.quantity || 0));
    const currentStock = Number(combination.stock || 0);
    if (quantity <= 0) throw new Error(`Cantidad invalida en ${item.productName}`);
    if (currentStock < quantity) {
      throw new Error(`${item.productName}${getVariantFullLabel(normalizeVariants(item.variantes))} no tiene stock suficiente`);
    }

    combination.stock = currentStock - quantity;
    const ingreso = await IngresoModel.create({
      fecha_ingreso: new Date(),
      estado: "salida_solicitada",
      cantidad_ingreso: -quantity,
      nombre_variante: `${product.nombre_producto}${getVariantFullLabel(normalizeVariants(item.variantes))}`,
      producto: product._id,
      vendedor: request.seller,
      sucursal: request.branch,
      combinacion: normalizeVariants(item.variantes),
    });

    product.ingreso = [...(product.ingreso || []), ingreso._id];
    await product.save();
    await VendedorModel.findByIdAndUpdate(request.seller, {
      $push: { ingreso: ingreso._id },
    });
  }

  request.status = "approved";
  request.approvedAt = new Date();
  if (params.userId && Types.ObjectId.isValid(params.userId)) {
    (request as any).approvedBy = new Types.ObjectId(params.userId);
  }
  await request.save();
  return buildDto(await request.populate("seller branch"));
};

const rejectRequest = async (params: { requestId: string; userId?: string; reason?: string }) => {
  const request = await StockWithdrawalRequestModel.findById(params.requestId);
  if (!request) throw new Error("Solicitud no encontrada");
  if (request.status !== "pending") throw new Error("La solicitud ya fue procesada");

  request.status = "rejected";
  request.rejectedAt = new Date();
  request.rejectionReason = String(params.reason || "").trim();
  if (params.userId && Types.ObjectId.isValid(params.userId)) {
    (request as any).rejectedBy = new Types.ObjectId(params.userId);
  }
  await request.save();
  return buildDto(await request.populate("seller branch"));
};

export const StockWithdrawalService = {
  listRequests,
  createRequest,
  approveRequest,
  rejectRequest,
};
