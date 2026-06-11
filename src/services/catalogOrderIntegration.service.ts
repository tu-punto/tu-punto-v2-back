import { Types } from "mongoose";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { createVariantKey } from "../utils/variantKey";

type CatalogOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  internalSellerId: string;
  internalProductId: string;
  internalVariantKey: string;
};

type CatalogOrderPayload = {
  orderId: string;
  customer: {
    name: string;
    phone?: string;
    ci?: string;
  };
  delivery: {
    method: "PICKUP" | "DELIVERY";
    internalBranchId?: string;
    pickupSlot?: string;
    address?: string;
    reference?: string;
  };
  currency: string;
  total: number;
  createdAt?: string;
  items: CatalogOrderItem[];
};

const text = (value: unknown) => String(value ?? "").trim();

type ReservedStockItem = {
  internalProductId: string;
  internalVariantKey: string;
  internalBranchId: string;
  quantity: number;
  currentStock: number;
};

const findCombination = (
  product: any,
  variantKey: string,
  preferredBranchId?: string,
  minimumStock = 0
) => {
  const branches = [...(product?.sucursales || [])].sort((a: any, b: any) => {
    if (!preferredBranchId) return 0;
    return String(a?.id_sucursal) === preferredBranchId
      ? -1
      : String(b?.id_sucursal) === preferredBranchId
        ? 1
        : 0;
  });

  for (const branch of branches) {
    if (preferredBranchId && String(branch?.id_sucursal) !== preferredBranchId) continue;
    const branchIndex = (product.sucursales || []).indexOf(branch);
    const combinationIndex = (branch?.combinaciones || []).findIndex((combination: any) => {
      const resolvedKey =
        text(combination?.variantKey) ||
        createVariantKey(String(product._id), combination?.variantes);
      return resolvedKey === variantKey && Number(combination?.stock || 0) >= minimumStock;
    });
    if (combinationIndex >= 0) {
      return { branchIndex, combinationIndex, branchId: String(branch.id_sucursal) };
    }
  }
  return null;
};

const reserveItemStock = async (
  orderId: string,
  item: CatalogOrderItem,
  preferredBranchId?: string
): Promise<ReservedStockItem> => {
  const productId = text(item.internalProductId);
  const variantKey = text(item.internalVariantKey);
  const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
  if (!Types.ObjectId.isValid(productId) || !variantKey) {
    throw new Error(`Producto sin vinculacion interna: ${text(item.name)}`);
  }

  const product = await ProductoModel.findById(productId).lean();
  if (!product) throw new Error(`Producto no encontrado: ${text(item.name)}`);
  const found = findCombination(product, variantKey, preferredBranchId, quantity);
  if (!found) throw new Error(`Variante no encontrada: ${text(item.name)}`);

  const stockPath = `sucursales.${found.branchIndex}.combinaciones.${found.combinationIndex}.stock`;
  const keyPath = `sucursales.${found.branchIndex}.combinaciones.${found.combinationIndex}.variantKey`;
  const reservationsPath =
    `sucursales.${found.branchIndex}.combinaciones.${found.combinationIndex}.catalog_reservations`;
  const updated = await ProductoModel.updateOne(
    {
      _id: productId,
      [stockPath]: { $gte: quantity },
      [`${reservationsPath}.orderId`]: { $ne: orderId }
    },
    {
      $inc: { [stockPath]: -quantity },
      $set: { [keyPath]: variantKey },
      $push: {
        [reservationsPath]: { orderId, quantity, createdAt: new Date() }
      }
    }
  );

  if (updated.modifiedCount !== 1) {
    throw new Error(`Stock insuficiente para ${text(item.name)}`);
  }
  const refreshed = await ProductoModel.findById(productId).lean();
  const refreshedCombination = findCombination(refreshed, variantKey, found.branchId);
  return {
    internalProductId: productId,
    internalVariantKey: variantKey,
    internalBranchId: found.branchId,
    quantity,
    currentStock: Number(
      refreshed?.sucursales?.[refreshedCombination?.branchIndex ?? -1]?.combinaciones?.[
        refreshedCombination?.combinationIndex ?? -1
      ]?.stock || 0
    )
  };
};

const restoreReservedStock = async (orderId: string, items: ReservedStockItem[]) => {
  const restoredItems: ReservedStockItem[] = [];
  for (const item of items) {
    const product = await ProductoModel.findById(item.internalProductId).lean();
    if (!product) throw new Error(`Producto no encontrado al restaurar stock: ${item.internalProductId}`);
    const found = findCombination(product, item.internalVariantKey, item.internalBranchId);
    if (!found) throw new Error(`Variante no encontrada al restaurar stock: ${item.internalVariantKey}`);

    const stockPath = `sucursales.${found.branchIndex}.combinaciones.${found.combinationIndex}.stock`;
    const reservationsPath =
      `sucursales.${found.branchIndex}.combinaciones.${found.combinationIndex}.catalog_reservations`;
    await ProductoModel.updateOne(
      { _id: item.internalProductId, [`${reservationsPath}.orderId`]: orderId },
      {
        $inc: { [stockPath]: item.quantity },
        $pull: { [reservationsPath]: { orderId } }
      }
    );
    const refreshed = await ProductoModel.findById(item.internalProductId).lean();
    const refreshedCombination = findCombination(
      refreshed,
      item.internalVariantKey,
      item.internalBranchId
    );
    restoredItems.push({
      ...item,
      currentStock: Number(
        refreshed?.sucursales?.[refreshedCombination?.branchIndex ?? -1]?.combinaciones?.[
          refreshedCombination?.combinationIndex ?? -1
        ]?.stock || 0
      )
    });
  }
  return restoredItems;
};

const createOrder = async (payload: CatalogOrderPayload) => {
  const orderId = text(payload?.orderId);
  if (!orderId) throw new Error("orderId es requerido");
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new Error("El pedido debe incluir productos");
  }

  const existing = await PedidoModel.findOne({ catalog_order_id: orderId });
  if (existing) {
    if ((existing as any).catalog_stock_status === "reserved") return existing;
    throw new Error("El pedido ya se esta procesando");
  }

  const invalidSeller = payload.items.find(
    (item) => !Types.ObjectId.isValid(text(item.internalSellerId))
  );
  if (invalidSeller) throw new Error("El pedido contiene un vendedor no valido");

  const branchId = text(payload.delivery?.internalBranchId);
  const destination =
    payload.delivery?.method === "PICKUP"
      ? "Retiro en sucursal"
      : text(payload.delivery?.address) || "Direccion indicada en catalogo";

  const order = await PedidoModel.create({
    cliente: text(payload.customer?.name) || "Cliente catalogo",
    telefono_cliente: text(payload.customer?.phone),
    carnet_cliente: text(payload.customer?.ci),
    tipo_de_pago: "Pendiente - pedido de catalogo",
    fecha_pedido: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    hora_entrega_acordada: new Date(),
    hora_entrega_real: new Date(),
    observaciones: [
      payload.delivery?.pickupSlot ? `Horario: ${text(payload.delivery.pickupSlot)}` : "",
      payload.delivery?.reference ? `Referencia: ${text(payload.delivery.reference)}` : ""
    ].filter(Boolean).join(" | "),
    lugar_origen: Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : undefined,
    sucursal: Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : undefined,
    tipo_destino: payload.delivery?.method === "PICKUP" ? "sucursal" : "otro_lugar",
    lugar_entrega: destination,
    costo_delivery: 0,
    cargo_delivery: 0,
    estado_pedido: "En Espera",
    esta_pagado: "no",
    adelanto_cliente: 0,
    pagado_al_vendedor: false,
    subtotal_qr: 0,
    subtotal_efectivo: 0,
    origen_pedido: "catalogo",
    catalog_order_id: orderId,
    catalog_status_sync: "synced",
    catalog_stock_status: "pending",
    productos_temporales: payload.items.map((item) => ({
      producto: text(item.name) || "Producto catalogo",
      cantidad: Math.max(1, Number(item.quantity) || 1),
      precio_unitario: Math.max(0, Number(item.unitPrice) || 0),
      utilidad: 0,
      id_vendedor: new Types.ObjectId(text(item.internalSellerId))
    }))
  });

  const reservedItems: ReservedStockItem[] = [];
  try {
    for (const item of payload.items) {
      reservedItems.push(await reserveItemStock(orderId, item, branchId || undefined));
    }
    (order as any).catalog_stock_items = reservedItems;
    (order as any).catalog_stock_status = "reserved";
    await order.save();
    return order;
  } catch (error) {
    await restoreReservedStock(orderId, reservedItems);
    await PedidoModel.deleteOne({ _id: order._id, catalog_stock_status: "pending" });
    throw error;
  }
};

const notifyCatalogRejected = async (
  catalogOrderId: string,
  reason: string,
  stockItems: ReservedStockItem[]
) => {
  const baseUrl = text(process.env.CATALOG_API_URL).replace(/\/+$/, "");
  const token = text(process.env.CATALOG_INTEGRATION_TOKEN);
  if (!baseUrl || !token) throw new Error("Callback al catalogo no configurado");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `${baseUrl}/integration/internal-catalog/orders/${encodeURIComponent(catalogOrderId)}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-catalog-integration-token": token
          },
          body: JSON.stringify({ reason, stockItems })
        }
      );
      if (!response.ok) throw new Error(`Catalogo respondio ${response.status}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No se pudo notificar al catalogo");
};

const notifyCatalogStatus = async (catalogOrderId: string, status: string) => {
  const baseUrl = text(process.env.CATALOG_API_URL).replace(/\/+$/, "");
  const token = text(process.env.CATALOG_INTEGRATION_TOKEN);
  if (!baseUrl || !token) throw new Error("Callback al catalogo no configurado");
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `${baseUrl}/integration/internal-catalog/orders/${encodeURIComponent(catalogOrderId)}/status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-catalog-integration-token": token
          },
          body: JSON.stringify({ status })
        }
      );
      if (!response.ok) throw new Error(`Catalogo respondio ${response.status}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No se pudo actualizar el estado en catalogo");
};

const syncOrderStatus = async (pedido: any) => {
  if (pedido?.origen_pedido !== "catalogo" || !pedido?.catalog_order_id) return;
  const statusMap: Record<string, string> = {
    "En Espera": "PENDING_REVIEW",
    "En camino": "SHIPPED",
    "Entregado": "COMPLETED",
    "Rechazado": "REJECTED",
    "Cancelado": "REJECTED",
    "No entregado": "REJECTED"
  };
  const catalogStatus = statusMap[text(pedido.estado_pedido)];
  if (!catalogStatus || catalogStatus === "REJECTED") return;
  try {
    await notifyCatalogStatus(text(pedido.catalog_order_id), catalogStatus);
    await PedidoModel.updateOne(
      { _id: pedido._id },
      { $set: { catalog_status_sync: "synced", catalog_status_sync_error: "" } }
    );
  } catch (error: any) {
    await PedidoModel.updateOne(
      { _id: pedido._id },
      {
        $set: {
          catalog_status_sync: "failed",
          catalog_status_sync_error: text(error?.message)
        }
      }
    );
  }
};

const rejectOrder = async (shippingId: string, reason: string, rejectedBy: string) => {
  const pedido = await PedidoModel.findById(shippingId);
  if (!pedido) throw new Error("Pedido no encontrado");
  if ((pedido as any).origen_pedido !== "catalogo" || !(pedido as any).catalog_order_id) {
    throw new Error("Solo se pueden rechazar pedidos originados en el catalogo");
  }
  if (pedido.estado_pedido === "Rechazado") {
    if ((pedido as any).catalog_status_sync !== "synced") {
      try {
        await notifyCatalogRejected(
          (pedido as any).catalog_order_id,
          (pedido as any).motivo_rechazo,
          Array.isArray((pedido as any).catalog_stock_items) ? (pedido as any).catalog_stock_items : []
        );
        (pedido as any).catalog_status_sync = "synced";
        (pedido as any).catalog_status_sync_error = "";
        await pedido.save();
      } catch (error: any) {
        (pedido as any).catalog_status_sync = "failed";
        (pedido as any).catalog_status_sync_error = text(error?.message);
        await pedido.save();
      }
    }
    return pedido;
  }

  if ((pedido as any).catalog_stock_status === "reserved") {
    const restoredItems = await restoreReservedStock(
      String((pedido as any).catalog_order_id),
      Array.isArray((pedido as any).catalog_stock_items) ? (pedido as any).catalog_stock_items : []
    );
    (pedido as any).catalog_stock_items = restoredItems;
    (pedido as any).catalog_stock_status = "restored";
  }
  pedido.estado_pedido = "Rechazado";
  (pedido as any).motivo_rechazo = text(reason) || "Pedido rechazado por Tu Punto";
  (pedido as any).rechazado_en = new Date();
  (pedido as any).rechazado_por = rejectedBy;
  (pedido as any).catalog_status_sync = "pending";
  await pedido.save();

  try {
    await notifyCatalogRejected(
      (pedido as any).catalog_order_id,
      (pedido as any).motivo_rechazo,
      Array.isArray((pedido as any).catalog_stock_items) ? (pedido as any).catalog_stock_items : []
    );
    (pedido as any).catalog_status_sync = "synced";
    (pedido as any).catalog_status_sync_error = "";
  } catch (error: any) {
    (pedido as any).catalog_status_sync = "failed";
    (pedido as any).catalog_status_sync_error = text(error?.message);
  }
  await pedido.save();
  return pedido;
};

export const CatalogOrderIntegrationService = { createOrder, rejectOrder, syncOrderStatus };
