import { Types } from "mongoose";
import { PedidoModel } from "../entities/implements/PedidoSchema";

type CatalogOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  internalSellerId: string;
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

const createOrder = async (payload: CatalogOrderPayload) => {
  const orderId = text(payload?.orderId);
  if (!orderId) throw new Error("orderId es requerido");
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new Error("El pedido debe incluir productos");
  }

  const existing = await PedidoModel.findOne({ catalog_order_id: orderId });
  if (existing) return existing;

  const invalidSeller = payload.items.find(
    (item) => !Types.ObjectId.isValid(text(item.internalSellerId))
  );
  if (invalidSeller) throw new Error("El pedido contiene un vendedor no valido");

  const branchId = text(payload.delivery?.internalBranchId);
  const destination =
    payload.delivery?.method === "PICKUP"
      ? "Retiro en sucursal"
      : text(payload.delivery?.address) || "Direccion indicada en catalogo";

  return PedidoModel.create({
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
    productos_temporales: payload.items.map((item) => ({
      producto: text(item.name) || "Producto catalogo",
      cantidad: Math.max(1, Number(item.quantity) || 1),
      precio_unitario: Math.max(0, Number(item.unitPrice) || 0),
      utilidad: 0,
      id_vendedor: new Types.ObjectId(text(item.internalSellerId))
    }))
  });
};

const notifyCatalogRejected = async (catalogOrderId: string, reason: string) => {
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
          body: JSON.stringify({ reason })
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

const rejectOrder = async (shippingId: string, reason: string, rejectedBy: string) => {
  const pedido = await PedidoModel.findById(shippingId);
  if (!pedido) throw new Error("Pedido no encontrado");
  if ((pedido as any).origen_pedido !== "catalogo" || !(pedido as any).catalog_order_id) {
    throw new Error("Solo se pueden rechazar pedidos originados en el catalogo");
  }
  if (pedido.estado_pedido === "Rechazado") return pedido;

  pedido.estado_pedido = "Rechazado";
  (pedido as any).motivo_rechazo = text(reason) || "Pedido rechazado por Tu Punto";
  (pedido as any).rechazado_en = new Date();
  (pedido as any).rechazado_por = rejectedBy;
  (pedido as any).catalog_status_sync = "pending";
  await pedido.save();

  try {
    await notifyCatalogRejected((pedido as any).catalog_order_id, (pedido as any).motivo_rechazo);
    (pedido as any).catalog_status_sync = "synced";
    (pedido as any).catalog_status_sync_error = "";
  } catch (error: any) {
    (pedido as any).catalog_status_sync = "failed";
    (pedido as any).catalog_status_sync_error = text(error?.message);
  }
  await pedido.save();
  return pedido;
};

export const CatalogOrderIntegrationService = { createOrder, rejectOrder };
