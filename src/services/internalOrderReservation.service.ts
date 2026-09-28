import { Types } from "mongoose";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { createVariantKey } from "../utils/variantKey";

const ACTIVE_INTERNAL_ORDER_STATUSES = new Set(["En Espera", "En camino", "LISTO PARA RECOGER"]);

const normalizeVariants = (value: any): Record<string, string> => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === "function") return value.toObject();
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? "")]));
};

const sameVariants = (left: any, right: any) => {
  const a = normalizeVariants(left);
  const b = normalizeVariants(right);
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
};

const clearOrderReservations = async (orderId: string) => {
  await ProductoModel.updateMany(
    { "sucursales.combinaciones.internal_reservations.orderId": orderId },
    { $pull: { "sucursales.$[].combinaciones.$[].internal_reservations": { orderId } } }
  );
};

const syncOrderReservations = async (orderId: string) => {
  if (!Types.ObjectId.isValid(orderId)) return;
  await clearOrderReservations(orderId);

  const order = await PedidoModel.findById(orderId).select("estado_pedido origen_pedido").lean();
  if (!order || order.origen_pedido === "catalogo" || !ACTIVE_INTERNAL_ORDER_STATUSES.has(String(order.estado_pedido || ""))) return;

  const sales = await VentaModel.find({ pedido: new Types.ObjectId(orderId) }).lean();
  for (const sale of sales) {
    const productId = String(sale?.producto || "");
    const branchId = String(sale?.sucursal || "");
    const quantity = Math.max(0, Number(sale?.cantidad || 0));
    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(branchId) || quantity <= 0) continue;

    const product = await ProductoModel.findById(productId);
    if (!product || product.esTemporal) continue;
    const branch = (product.sucursales || []).find((item: any) => String(item?.id_sucursal) === branchId);
    if (!branch) continue;

    const saleVariantKey = String((sale as any)?.variantKey || "").trim();
    const combination = (branch.combinaciones || []).find((item: any) => {
      const combinationKey = String(item?.variantKey || createVariantKey(productId, item?.variantes)).trim();
      return saleVariantKey ? combinationKey === saleVariantKey : sameVariants(item?.variantes, (sale as any)?.variantes);
    });
    if (!combination) continue;

    const reservations = Array.isArray((combination as any).internal_reservations)
      ? (combination as any).internal_reservations
      : [];
    const existing = reservations.find((reservation: any) => String(reservation?.orderId) === orderId);
    if (existing) existing.quantity = Number(existing.quantity || 0) + quantity;
    else reservations.push({ orderId, quantity, createdAt: new Date() });
    (combination as any).internal_reservations = reservations;
    product.markModified("sucursales");
    await product.save();
  }
};

const syncOrderReservationsSafe = async (orderId: string) => {
  try {
    await syncOrderReservations(orderId);
  } catch (error) {
    console.error("No se pudieron sincronizar las reservas internas del pedido:", error);
  }
};

const backfillActiveOrderReservations = async () => {
  const orders = await PedidoModel.find({
    origen_pedido: { $ne: "catalogo" },
    estado_pedido: { $in: Array.from(ACTIVE_INTERNAL_ORDER_STATUSES) }
  }).select("_id").lean();

  await ProductoModel.updateMany(
    { "sucursales.combinaciones.internal_reservations.0": { $exists: true } },
    { $set: { "sucursales.$[].combinaciones.$[].internal_reservations": [] } }
  );
  for (const order of orders) await syncOrderReservations(String(order._id));
  return { ordersProcessed: orders.length };
};

export const InternalOrderReservationService = {
  syncOrderReservations,
  syncOrderReservationsSafe,
  backfillActiveOrderReservations
};
