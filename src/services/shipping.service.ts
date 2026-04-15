import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { Types } from "mongoose";
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { SaleService } from "./sale.service";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import dayjs from 'dayjs';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from "uuid";
import { QRService } from "./qr.service";
import { ShippingStatusHistoryModel } from "../entities/implements/ShippingStatusHistorySchema";
import { BoxCloseRepository } from "../repositories/boxClose.repository";
import { NotificationService } from "./notification.service";

const getAllShippings = async () => {
  return await ShippingRepository.findAll();
};

const PAYMENT_TYPE_LABEL_BY_CODE: Record<string, string> = {
  "1": "Transferencia o QR",
  "2": "Efectivo",
  "3": "Pagado al dueño",
  "4": "Efectivo + QR"
};

const normalizePaymentType = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (PAYMENT_TYPE_LABEL_BY_CODE[trimmed]) return PAYMENT_TYPE_LABEL_BY_CODE[trimmed];

  const normalized = trimmed.toLowerCase();
  const existingLabel = Object.values(PAYMENT_TYPE_LABEL_BY_CODE).find(
    (label) => label.toLowerCase() === normalized
  );

  return existingLabel || trimmed;
};

const normalizeOrderPaymentData = (payload: any, currentShipping?: any) => {
  const normalizedType = normalizePaymentType(payload.tipo_de_pago ?? currentShipping?.tipo_de_pago);
  const nextStatus = payload.estado_pedido ?? currentShipping?.estado_pedido;
  const nextPaidStatus = payload.esta_pagado ?? currentShipping?.esta_pagado;

  if (normalizedType) {
    payload.tipo_de_pago = normalizedType;
  }

  if (nextStatus === "Entregado" && nextPaidStatus === "si") {
    payload.tipo_de_pago = PAYMENT_TYPE_LABEL_BY_CODE["3"];
  }

  if ((payload.tipo_de_pago || normalizedType) === PAYMENT_TYPE_LABEL_BY_CODE["3"]) {
    payload.pagado_al_vendedor = true;
    payload.adelanto_cliente = 0;
    payload.subtotal_qr = 0;
    payload.subtotal_efectivo = 0;
  } else if ("pagado_al_vendedor" in payload && nextPaidStatus !== "si") {
    payload.pagado_al_vendedor = false;
  }
};

const normalizeTextValue = (value: unknown): string => String(value ?? "").trim();
const normalizeBranchName = (value: unknown): string =>
  normalizeTextValue(value).toLowerCase().replace(/\s+/g, " ");

const resolveBranchId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value?._id || value?.id_sucursal || value?.$oid || "");
  }
  return "";
};

const buildGoogleMapsSearchUrl = (query: string): string => {
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const normalizeDestinationType = (value: unknown): "sucursal" | "otro_lugar" =>
  value === "sucursal" || value === "esta_sucursal" ? "sucursal" : "otro_lugar";

const findBranchByName = async (value: unknown) => {
  const normalizedName = normalizeBranchName(value);
  if (!normalizedName) return null;

  const branches = await SucursalModel.find({}, { _id: 1, nombre: 1 }).lean();
  return (
    branches.find((branch: any) => normalizeBranchName(branch?.nombre) === normalizedName) ||
    null
  );
};

const resolvePaymentBranchId = (shipping: any): string =>
  resolveBranchId(shipping?.sucursal) || resolveBranchId(shipping?.lugar_origen);

const resolveOriginBranchId = (shipping: any): string => resolveBranchId(shipping?.lugar_origen);

const canMarkDeliveredFromBranch = (shipping: any, branchId?: string | null): boolean => {
  if (!branchId) return true;
  const paymentBranchId = resolvePaymentBranchId(shipping);
  return !paymentBranchId || paymentBranchId === String(branchId);
};

const getSimplePackageMethodFromShipping = (shipping: any): "" | "efectivo" | "qr" => {
  if (Number(shipping?.subtotal_qr || 0) > 0) return "qr";
  if (Number(shipping?.subtotal_efectivo || 0) > 0) return "efectivo";
  const normalizedType = String(shipping?.tipo_de_pago || "").trim().toLowerCase();
  if (normalizedType === "1" || normalizedType === "transferencia o qr") return "qr";
  if (normalizedType === "2" || normalizedType === "efectivo") return "efectivo";
  return "";
};

const attachSimplePackageFieldsToShipping = async (shipping: any) => {
  if (!shipping) return shipping;

  const simplePackageSourceId = String(
    shipping?.simple_package_source_id?._id ||
      shipping?.simple_package_source_id ||
      ""
  ).trim();

  if (!simplePackageSourceId) return shipping;

  const simplePackage = await SimplePackageRepository.getSimplePackageByID(simplePackageSourceId);
  if (!simplePackage) return shipping;

  const base =
    typeof shipping?.toObject === "function"
      ? shipping.toObject()
      : { ...shipping };

  return {
    ...base,
    precio_paquete: Number((simplePackage as any)?.precio_paquete || 0),
    saldo_por_paquete: Number((simplePackage as any)?.saldo_por_paquete || 0),
    precio_entre_sucursal: Number((simplePackage as any)?.precio_entre_sucursal || 0),
    amortizacion_vendedor: Number((simplePackage as any)?.amortizacion_vendedor || 0),
    deuda_comprador: Number((simplePackage as any)?.deuda_comprador || 0),
  };
};

const attachSimplePackageFieldsToShippings = async (rows: any[]) => {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const packageIds = rows
    .map((row: any) =>
      String(row?.simple_package_source_id?._id || row?.simple_package_source_id || "").trim()
    )
    .filter(Boolean);

  if (!packageIds.length) return rows;

  const simplePackages = await SimplePackageRepository.getSimplePackagesByIDs(packageIds);
  const packageMap = new Map(
    simplePackages.map((row: any) => [String(row?._id || ""), row])
  );

  return rows.map((shipping: any) => {
    const simplePackageSourceId = String(
      shipping?.simple_package_source_id?._id ||
        shipping?.simple_package_source_id ||
        ""
    ).trim();

    if (!simplePackageSourceId) return shipping;

    const simplePackage = packageMap.get(simplePackageSourceId);
    if (!simplePackage) return shipping;

    const base =
      typeof shipping?.toObject === "function"
        ? shipping.toObject()
        : { ...shipping };

    return {
      ...base,
      precio_paquete: Number((simplePackage as any)?.precio_paquete || 0),
      saldo_por_paquete: Number((simplePackage as any)?.saldo_por_paquete || 0),
      precio_entre_sucursal: Number((simplePackage as any)?.precio_entre_sucursal || 0),
      amortizacion_vendedor: Number((simplePackage as any)?.amortizacion_vendedor || 0),
      deuda_comprador: Number((simplePackage as any)?.deuda_comprador || 0),
    };
  });
};

const normalizeShippingBranches = async (payload: any, currentShipping?: any) => {
  const originId = resolveBranchId(
    payload?.lugar_origen ?? currentShipping?.lugar_origen
  );
  const requestedPaymentBranchId = resolveBranchId(
    payload?.sucursal ?? payload?.id_sucursal ?? currentShipping?.sucursal
  );
  const lugarEntrega = normalizeTextValue(
    payload?.lugar_entrega ?? currentShipping?.lugar_entrega
  );
  const ubicacionLinkRaw = normalizeTextValue(
    payload?.ubicacion_link ?? currentShipping?.ubicacion_link
  );
  const storedDestinationType = payload?.tipo_destino ?? currentShipping?.tipo_destino;
  const matchedBranchByName = await findBranchByName(lugarEntrega);
  const legacyDestinationBranchId = resolveBranchId(matchedBranchByName?._id);
  const destinationType = storedDestinationType
    ? normalizeDestinationType(storedDestinationType)
    : ((requestedPaymentBranchId && requestedPaymentBranchId !== originId) || legacyDestinationBranchId
      ? "sucursal"
      : "otro_lugar");
  const destinationBranchId =
    destinationType === "sucursal"
      ? (
        (requestedPaymentBranchId && requestedPaymentBranchId !== originId
          ? requestedPaymentBranchId
          : "") ||
        legacyDestinationBranchId ||
        requestedPaymentBranchId ||
        originId
      )
      : originId;
  const resolvedLugarEntrega: string =
    destinationType === "sucursal"
      ? normalizeTextValue(matchedBranchByName?.nombre) || lugarEntrega
      : lugarEntrega;

  payload.tipo_destino = destinationType;
  payload.lugar_entrega = resolvedLugarEntrega;
  payload.ubicacion_link =
    ubicacionLinkRaw ||
    (destinationType === "otro_lugar" ? buildGoogleMapsSearchUrl(resolvedLugarEntrega) : "");

  if (originId) {
    payload.lugar_origen = originId;
  }

  if (destinationType === "sucursal" && destinationBranchId) {
    payload.sucursal = destinationBranchId;
    return;
  }

  if (originId) {
    payload.sucursal = originId;
  }
};

const getShippingsList = async (params: {
  page?: number;
  limit?: number;
  status?: string;
  from?: Date;
  to?: Date;
  originId?: string;
  branchContextId?: string;
  sellerId?: string;
  client?: string;
}) => {
  const result = await ShippingRepository.findList(params);
  return {
    ...result,
    rows: await attachSimplePackageFieldsToShippings(result.rows || []),
  };
};

const getShippingsByDateRange = async (from?: Date, to?: Date, sucursalIds?: string[]) => {
  const rows = await ShippingRepository.findByDateRange(from, to, sucursalIds);
  return await attachSimplePackageFieldsToShippings(rows);
};

const getShippingByIds = async (shippingIds: string[]) => {
  const shippings = await ShippingRepository.findByIds(shippingIds);
  if (!shippings.length)
    throw new Error(`No shippings found for the provided IDs`);
  return await attachSimplePackageFieldsToShippings(shippings);
};

const registerShipping = async (shipping: any) => {
  normalizeOrderPaymentData(shipping);
  await normalizeShippingBranches(shipping);

  if (shipping.fecha_pedido) {
    shipping.fecha_pedido = moment.tz(shipping.fecha_pedido, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  if (shipping.hora_entrega_real) {
    shipping.hora_entrega_real = moment.tz(shipping.hora_entrega_real, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  if (shipping.hora_entrega_acordada) {
    shipping.hora_entrega_acordada = moment.tz(shipping.hora_entrega_acordada, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  
  if (!shipping.fecha_pedido) {
    shipping.fecha_pedido = moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  if (!shipping.hora_entrega_acordada) {
    shipping.hora_entrega_acordada = moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  if (!shipping.hora_entrega_real) {
    shipping.hora_entrega_real = moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  const savedShipping = await ShippingRepository.registerShipping(shipping);
  const trackingCode = await NotificationService.ensureBuyerTrackingCode(savedShipping);

  if (savedShipping && !(savedShipping as any).buyer_tracking_code) {
    (savedShipping as any).buyer_tracking_code = trackingCode;
  }

  void NotificationService.handleShippingCreated(
    typeof (savedShipping as any)?.toObject === "function"
      ? (savedShipping as any).toObject()
      : savedShipping
  );

  return savedShipping;
};
const getShippingById = async (id: string) => {
  const shipping = await ShippingRepository.findById(id);
  return await attachSimplePackageFieldsToShipping(shipping);
};

const SHIPPING_QR_PREFIX = "TP|v1|SHIP|";

const buildShippingQRCode = (shippingId: string): string => {
  const suffix = uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `SHIP-${shippingId.slice(-6)}-${suffix}`;
};

const buildShippingQRPayload = (shippingCode: string): string => {
  return `${SHIPPING_QR_PREFIX}${shippingCode}`;
};

const extractShippingCodeFromPayload = (payload: string): string | null => {
  const value = payload?.trim();
  if (!value) return null;

  if (value.startsWith(SHIPPING_QR_PREFIX)) {
    return value.replace(SHIPPING_QR_PREFIX, "");
  }

  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/\/shipping\/qr\/([^/?#]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

    const codeInQuery = url.searchParams.get("ship") || url.searchParams.get("shipping");
    if (codeInQuery) return codeInQuery;
  } catch {
    // no-op
  }

  return value;
};

const resolveShippingByCodeOrId = async (codeOrId: string) => {
  const byCode = await PedidoModel.findOne({ shipping_qr_code: codeOrId });
  if (byCode) return byCode;

  if (Types.ObjectId.isValid(codeOrId)) {
    return PedidoModel.findById(codeOrId);
  }

  return null;
};

const allowedShippingTransitions: Record<string, string[]> = {
  "En Espera": ["En camino", "Entregado", "No entregado", "Cancelado"],
  "En camino": ["Entregado", "No entregado", "Cancelado"],
  "No entregado": ["En camino", "Cancelado"],
  "Cancelado": [],
  "Entregado": []
};

const actualizarSaldoVendedor = async (
  ventas: {
    id_vendedor: string;
    utilidad: number;
    id_pedido?: string;
    subtotal: number;
    pagado_al_vendedor: boolean;
  }[]
) => {

  const vendedoresMap = new Map<string, number>();
  const pedidosProcesados = new Set();

  for (const venta of ventas) {
    const { id_vendedor, utilidad, id_pedido, subtotal, pagado_al_vendedor } = venta;
    let saldoPendiente = 0;
    if (!id_pedido) {
      throw new Error("id_pedido is required for calculating saldo pendiente");
    }

    const pedido = await PedidoModel.findById(id_pedido)
      .select("adelanto_cliente cargo_delivery pagado_al_vendedor")
      .lean();

    if (!pedido) {
      console.error(`❌ Pedido con id ${id_pedido} no encontrado`);
      continue;
    }


    if (pedido.pagado_al_vendedor) {
      saldoPendiente = -utilidad;
      console.log(`→ Pagado al vendedor: saldoPendiente = -utilidad (${-utilidad})`);
    } else {
      saldoPendiente = subtotal - utilidad;
      console.log(`→ No pagado: saldoPendiente = subtotal - utilidad (${subtotal} - ${utilidad} = ${saldoPendiente})`);
    }

    if (!pedidosProcesados.has(id_pedido.toString())) {
      const adelanto = pedido.adelanto_cliente || 0;
      const delivery = pedido.cargo_delivery || 0;
      saldoPendiente -= adelanto;
      saldoPendiente -= delivery;
      pedidosProcesados.add(id_pedido.toString());
    }

    const currentSaldo = vendedoresMap.get(id_vendedor) || 0;
    vendedoresMap.set(id_vendedor, currentSaldo + saldoPendiente);
    console.log(`→ Updated vendedor ${id_vendedor} accumulated saldo: ${currentSaldo + saldoPendiente}`);
  }

  // Actualizar el saldo pendiente de cada vendedor
  for (const [id_vendedor, saldoTotal] of vendedoresMap.entries()) {
  if (!id_vendedor || typeof id_vendedor !== "string" || id_vendedor.length !== 24) {
    console.error(`❌ ID de vendedor inválido: ${id_vendedor}`);
    continue;
  }

  const vendedorBefore = await VendedorModel.findById(id_vendedor).lean();
  console.log(`→ Current saldo_pendiente: ${vendedorBefore?.saldo_pendiente}`);

  await VendedorModel.findByIdAndUpdate(id_vendedor, {
    $inc: { saldo_pendiente: saldoTotal },
  });

  const vendedorAfter = await VendedorModel.findById(id_vendedor).lean();
  console.log(`→ New saldo_pendiente: ${vendedorAfter?.saldo_pendiente}`);
}

};

const registerSaleToShipping = async (
  shippingId: string,
  saleWithoutShippingId: any
) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  const payload = {
    ...saleWithoutShippingId,
    id_pedido: shipping._id,
    sucursal: saleWithoutShippingId.sucursal || saleWithoutShippingId.id_sucursal,
  };

  const created = await SaleService.registerSale(payload);
  return created[0];
};

const updateShipping = async (
  newData: any,
  shippingId: string,
  options?: {
    currentBranchId?: string | null;
    source?: "qr" | "manual" | "system";
    changedBy?: string;
    note?: string;
  }
) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  normalizeOrderPaymentData(newData, shipping);
  await normalizeShippingBranches(newData, shipping);

  if ('fecha_pedido' in newData) {
    delete newData.fecha_pedido;
  }

  if (newData.hora_entrega_acordada) {
    newData.hora_entrega_acordada = moment
      .tz(newData.hora_entrega_acordada, "America/La_Paz")
      .format("YYYY-MM-DD HH:mm:ss");
  }

  if (newData.hora_entrega_rango_final) {
    newData.hora_entrega_rango_final = moment
      .tz(newData.hora_entrega_rango_final, "America/La_Paz")
      .format("YYYY-MM-DD HH:mm:ss");
  }

  if (!newData.hora_entrega_real && newData.hora_entrega_acordada) {
    newData.hora_entrega_real = newData.hora_entrega_acordada;
  }

  if (newData.hora_entrega_real) {
    newData.hora_entrega_real = moment
      .tz(newData.hora_entrega_real, "America/La_Paz")
      .format("YYYY-MM-DD HH:mm:ss");
  }

  const wasDelivered = shipping.estado_pedido === "Entregado";
  const willBeDelivered = newData.estado_pedido === "Entregado";
  const fromStatus = shipping.estado_pedido || "En Espera";
  const toStatus = newData.estado_pedido || fromStatus;
  const nextShippingState = {
    ...(typeof (shipping as any)?.toObject === "function" ? (shipping as any).toObject() : shipping),
    ...newData,
  };

  if (willBeDelivered && !canMarkDeliveredFromBranch(nextShippingState, options?.currentBranchId)) {
    throw new Error("Solo la sucursal destino puede marcar este pedido como entregado");
  }

  if (willBeDelivered && !wasDelivered) {
    const sales = await SaleService.getSalesByShippingId(shippingId);
    const salesToUpdateSaldo: any = [];

    sales.forEach((sale) => {
      const subtotal = sale.cantidad * sale.precio_unitario;
      salesToUpdateSaldo.push({
        id_vendedor: sale.id_vendedor.toString(),
        utilidad: sale.utilidad,
        id_pedido: shippingId,
        subtotal: newData.pagado_al_vendedor ? 0 : subtotal,
        pagado_al_vendedor: !!newData.pagado_al_vendedor,
      });
    });

    if (salesToUpdateSaldo.length > 0) {
      await actualizarSaldoVendedor(salesToUpdateSaldo);
    }
  }

  const resShip = await ShippingRepository.updateShipping(newData, shippingId);

  const simplePackageSourceId = String(
    (resShip as any)?.simple_package_source_id ||
    (shipping as any)?.simple_package_source_id ||
    ""
  ).trim();

  if (resShip && simplePackageSourceId) {
    await SimplePackageRepository.updateSimplePackageByID(simplePackageSourceId, {
      estado_pedido: (resShip as any).estado_pedido,
      delivered: String((resShip as any).estado_pedido || "").trim() === "Entregado",
      seller_balance_applied: String((resShip as any).estado_pedido || "").trim() === "Entregado",
      esta_pagado: String((resShip as any).esta_pagado || "").trim().toLowerCase() === "si" ? "si" : "no",
      metodo_pago: getSimplePackageMethodFromShipping(resShip),
    });
  }

  if (resShip && toStatus !== fromStatus) {
    await ShippingStatusHistoryModel.create({
      shippingId: shipping._id,
      fromStatus,
      toStatus,
      changedBy: options?.changedBy,
      note: options?.note,
      source: options?.source || "manual",
    });

    void NotificationService.handleShippingStatusChange({
      before:
        typeof (shipping as any)?.toObject === "function"
          ? (shipping as any).toObject()
          : shipping,
      after:
        typeof (resShip as any)?.toObject === "function"
          ? (resShip as any).toObject()
          : resShip,
    });
  }

  return resShip;
};

const getShippingsBySellerService = async (sellerId: string) => {
  const salesBySeller = await SaleRepository.findBySellerId(sellerId);

  const uniqueShippings: IPedidoDocument[] = [];
  const checkedShippings: { [key: string]: boolean } = {};

  for (const sale of salesBySeller) {
    const pedidoPopulado = await sale.populate("pedido");
    const pedidoId = pedidoPopulado.pedido?._id?.toString();

    if (pedidoId && !checkedShippings[pedidoId]) {
      checkedShippings[pedidoId] = true;
      uniqueShippings.push(pedidoPopulado.pedido as IPedidoDocument);
    }
  }

  return uniqueShippings;
};

const addTemporaryProductsToShipping = async (
  shippingId: string,
  productosTemporales: any[]
) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  await PedidoModel.findByIdAndUpdate(shippingId, {
    $set: {
      productos_temporales: productosTemporales,
    },
  });
};

const deleteShippingById = async (id: string) => {
  const pedido = await PedidoModel.findById(id);
  if (!pedido) throw new Error("Pedido no encontrado");

  if (pedido.venta && pedido.venta.length > 0) {
    for (const ventaId of pedido.venta) {
      await SaleService.deleteSaleById(String(ventaId));
    }
  }

  await ShippingRepository.deleteById(id);
  return { success: true };
};

const processSalesForShipping = async (shippingId: string, sales: any[]) => {
  const savedSales = [];
  const salesToUpdateSaldo = [];

  for (let sale of sales) {
    let productId = sale.id_producto;

    if (!productId || productId.length !== 24) {
      const nuevoProducto = await ProductoModel.create({
      nombre_producto: sale.nombre_variante || sale.producto,
      id_vendedor: sale.id_vendedor,
      id_categoria: sale.id_categoria || undefined,
      esTemporal: true,
      sucursales: [{
        id_sucursal: sale.sucursal,
        combinaciones: [{
          variantes: {
            Variante: "Temporal" 
          },
          precio: sale.precio_unitario,
          stock: sale.cantidad || 1
        }]
      }]
    });

      productId = nuevoProducto._id;
    }

    const venta = await registerSaleToShipping(shippingId, {
      ...sale,
      id_producto: productId,
      producto: productId,
      sucursal: sale.sucursal || sale.id_sucursal,
    });

    savedSales.push(venta);

    const pedido = await PedidoModel.findById(shippingId).lean();

    if (pedido?.estado_pedido === "Entregado" || pedido?.estado_pedido === "interno") {
      const subtotal = venta.cantidad * venta.precio_unitario;
      salesToUpdateSaldo.push({
        id_vendedor: String(venta.vendedor),
        utilidad: venta.utilidad,
        id_pedido: shippingId,
        subtotal: pedido.pagado_al_vendedor ? 0 : subtotal,
        pagado_al_vendedor: pedido.pagado_al_vendedor
      });
    }
  }

  await actualizarSaldoVendedor(salesToUpdateSaldo);

  return { success: true, ventas: savedSales };
};
const getDailySalesHistory = async (
  date: string | undefined,
  sucursalId: string,
  fromLastClose = false
) => {
  const nowLaPaz = moment.tz("America/La_Paz");
  const baseMoment = date
    ? moment.tz(date, ["YYYY-MM-DD", moment.ISO_8601], "America/La_Paz")
    : nowLaPaz.clone();

  if (!baseMoment.isValid()) {
    throw new Error("Invalid date received for sales history");
  }

  const startOfDay = baseMoment.clone().startOf("day").toDate();
  const endOfSelectedDay = baseMoment.clone().endOf("day");
  const isToday = baseMoment.isSame(nowLaPaz, "day");
  const periodEnd = (date
    ? (isToday ? nowLaPaz : endOfSelectedDay)
    : nowLaPaz
  ).toDate();

  const filter: any = {
    estado_pedido: { $ne: "En Espera" }
  };

  const getHistoryDate = (pedido: any): Date => {
    const estado = String(pedido?.estado_pedido || "").trim().toLowerCase();
    if (estado === "interno") return pedido?.fecha_pedido;
    if (estado === "entregado") return pedido?.hora_entrega_real || pedido?.fecha_pedido;
    return pedido?.hora_entrega_acordada || pedido?.fecha_pedido;
  };

  if (fromLastClose) {
    const lastClose = await BoxCloseRepository.findLatestBySucursalBefore(
      sucursalId,
      periodEnd
    );

    const periodStart = lastClose?.created_at
      ? new Date(lastClose.created_at)
      : startOfDay;

    filter.$and = [
      {
        $or: [
          {
            estado_pedido: "interno",
            fecha_pedido: { $gt: periodStart, $lte: periodEnd },
          },
          {
            estado_pedido: "Entregado",
            hora_entrega_real: { $gt: periodStart, $lte: periodEnd },
          },
        ],
      },
    ];
  } else if (date) {
    filter.hora_entrega_acordada = { $gte: startOfDay, $lte: periodEnd };
  } else {
    filter.hora_entrega_acordada = { $lte: new Date() };
  }

  const pedidos = await PedidoModel.find(filter)
    .populate({
      path: 'venta',
      populate: [
        { path: 'vendedor', select: 'nombre apellido' },
        { path: 'producto', select: 'nombre_producto' }
      ]
    })
    .sort(fromLastClose ? { hora_entrega_real: -1, fecha_pedido: -1 } : { hora_entrega_acordada: -1 })
    .lean();

  const pedidosFiltrados = pedidos.filter((pedido: any) => {
    const estado = String(pedido?.estado_pedido || "").trim().toLowerCase();
    const paymentBranchId = resolvePaymentBranchId(pedido);
    const originBranchId = resolveOriginBranchId(pedido);

    if (estado === "interno") {
      return paymentBranchId === sucursalId || originBranchId === sucursalId;
    }

    return paymentBranchId === sucursalId;
  });

  const resumen = pedidosFiltrados.map(p => {
    const ventasNormales = (Array.isArray(p.venta) ? p.venta : []).filter((v: any) =>
      v && typeof v === 'object' &&
      typeof v.precio_unitario === 'number' &&
      typeof v.cantidad === 'number'
    );

    const ventasTemporales = (Array.isArray(p.productos_temporales) ? p.productos_temporales : []).filter((v: any) =>
      v && typeof v === 'object' &&
      typeof v.precio_unitario === 'number' &&
      typeof v.cantidad === 'number'
    );

    const montoTotal = [...ventasNormales, ...ventasTemporales].reduce(
      (acc, v: any) => acc + (v.precio_unitario * v.cantidad), 0
    );

    return {
      _id: p._id,
      fecha: getHistoryDate(p),
      hora: dayjs(getHistoryDate(p)).format("HH:mm"),
      tipo_de_pago: p.tipo_de_pago,
      monto_total: montoTotal,
      subtotal_efectivo: p.subtotal_efectivo || 0,
      subtotal_qr: p.subtotal_qr || 0,
      esta_pagado: p.esta_pagado
    };
  });

  const totales = resumen.reduce((acc, curr) => {
    acc.efectivo += curr.subtotal_efectivo;
    acc.qr += curr.subtotal_qr;
    return acc;
  }, { efectivo: 0, qr: 0 });

  return { resumen, totales };
};

const saveQRCode = async (shippingId: string, qrCode: string) => {
  return await PedidoModel.findByIdAndUpdate(
    shippingId,
    { $set: { qr_code: qrCode } },
    { new: true }
  );
};

const generateShippingQR = async (shippingId: string, forceRegenerate = false) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping) {
    throw new Error("Pedido no encontrado");
  }

  if (
    !forceRegenerate &&
    shipping.shipping_qr_code &&
    shipping.shipping_qr_payload &&
    shipping.shipping_qr_image_path
  ) {
    return {
      shippingId,
      shippingQrCode: shipping.shipping_qr_code,
      shippingQrPayload: shipping.shipping_qr_payload,
      shippingQrImagePath: shipping.shipping_qr_image_path
    };
  }

  const shippingQrCode = buildShippingQRCode(shippingId);
  const shippingQrPayload = buildShippingQRPayload(shippingQrCode);
  const { qrPath } = await QRService.generatePayloadQRToS3(
    shippingQrPayload,
    `shipping-${shippingId}`
  );

  await PedidoModel.findByIdAndUpdate(shippingId, {
    $set: {
      shipping_qr_code: shippingQrCode,
      shipping_qr_payload: shippingQrPayload,
      shipping_qr_image_path: qrPath,
      qr_code: shippingQrPayload
    }
  });

  return {
    shippingId,
    shippingQrCode,
    shippingQrPayload,
    shippingQrImagePath: qrPath
  };
};

const getShippingDetailsForQR = async (shippingCodeOrId: string) => {
  const shipping = await resolveShippingByCodeOrId(shippingCodeOrId);
  if (!shipping) return null;

  const detailedShipping = await PedidoModel.findById(shipping._id)
    .populate([
      {
        path: 'venta',
        populate: [
          {
            path: 'vendedor',
            select: 'nombre apellido',
          },
          {
            path: 'producto',
            select: 'nombre_producto precio'
          }
        ]
      },
      'sucursal',
      'trabajador'
    ])
    .lean();
  return await attachSimplePackageFieldsToShipping(detailedShipping);
};

const resolveShippingByQRPayload = async (payload: string) => {
  const code = extractShippingCodeFromPayload(payload);
  if (!code) return null;
  return getShippingDetailsForQR(code);
};

const transitionShippingStatusByQR = async (params: {
  payload?: string;
  shippingCode?: string;
  shippingId?: string;
  toStatus: string;
  currentBranchId?: string;
  changedBy?: string;
  note?: string;
}) => {
  const resolvedCode =
    (params.payload && extractShippingCodeFromPayload(params.payload)) ||
    params.shippingCode ||
    params.shippingId;

  if (!resolvedCode) {
    throw new Error("No se recibió payload/código/id para resolver el pedido");
  }

  const shipping = await resolveShippingByCodeOrId(resolvedCode);
  if (!shipping) {
    throw new Error("Pedido no encontrado para el QR proporcionado");
  }

  const fromStatus = shipping.estado_pedido || "En Espera";
  const toStatus = params.toStatus;

  if (fromStatus === toStatus) {
    return {
      changed: false,
      shipping: await getShippingDetailsForQR(String(shipping._id))
    };
  }

  const allowed = allowedShippingTransitions[fromStatus] || [];
  if (allowed.length > 0 && !allowed.includes(toStatus)) {
    throw new Error(`Transición inválida: ${fromStatus} -> ${toStatus}`);
  }

  const updateData: Record<string, unknown> = {
    estado_pedido: toStatus
  };

  if (toStatus === "Entregado") {
    updateData.hora_entrega_real = moment()
      .tz("America/La_Paz")
      .format("YYYY-MM-DD HH:mm:ss");
  }

  await updateShipping(updateData, String(shipping._id), {
    currentBranchId: params.currentBranchId,
    source: "qr",
    changedBy: params.changedBy,
    note: params.note,
  });

  return {
    changed: true,
    shipping: await getShippingDetailsForQR(String(shipping._id))
  };
};

const getShippingStatusHistory = async (shippingId: string) => {
  return await ShippingStatusHistoryModel.find({
    shippingId: new Types.ObjectId(shippingId)
  })
    .sort({ createdAt: -1 })
    .lean();
};

export const ShippingService = {
  getAllShippings,
  getShippingsList,
  getShippingsByDateRange,
  getShippingByIds,
  registerShipping,
  registerSaleToShipping,
  updateShipping,
  getShippingById,
  getShippingsBySellerService,
  addTemporaryProductsToShipping,
  deleteShippingById,
  processSalesForShipping,
  getDailySalesHistory,
  saveQRCode,
  getShippingDetailsForQR,
  generateShippingQR,
  resolveShippingByQRPayload,
  transitionShippingStatusByQR,
  getShippingStatusHistory
};
