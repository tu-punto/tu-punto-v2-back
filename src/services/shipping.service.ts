import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { Types } from "mongoose";
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { CategoriaModel } from "../entities/implements/CategoriaSchema";
import { SaleService } from "./sale.service";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import dayjs from 'dayjs';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from "uuid";
import { ShippingStatusHistoryModel } from "../entities/implements/ShippingStatusHistorySchema";
import { BoxCloseRepository } from "../repositories/boxClose.repository";
import { NotificationService } from "./notification.service";
import { ExternalSaleRepository } from "../repositories/external.repository";
import { ExternalSaleService } from "./external.service";
import { OrderGuideService } from "./orderGuide.service";
import { OrderGuideWhatsappService } from "./orderGuideWhatsapp.service";
import { addLatePickupFeeToPayment, calculateLatePickupFee, resolveBranchPickupFeeStart } from "../utils/latePickupFee";
import { CatalogOrderIntegrationService } from "./catalogOrderIntegration.service";
import { assertEditableIfNotDeliveredOlderThanFiveDays } from "./deliveryEditGuard";

const getAllShippings = async () => {
  return await ShippingRepository.findAll();
};

const WAITING_RAW_STATUS = "En Espera";
const READY_FOR_PICKUP_VISUAL_STATUS = "LISTO PARA RECOGER";
const IN_TRANSIT_STATUS = "En camino";
const INTERNAL_SALE_STATUS = "interno";
const VISUAL_IN_TRANSIT_THRESHOLD_MINUTES = 30;

let cachedTemporaryCategoryId = "";

const resolveTemporaryCategoryId = async () => {
  if (cachedTemporaryCategoryId && Types.ObjectId.isValid(cachedTemporaryCategoryId)) {
    return cachedTemporaryCategoryId;
  }

  const category = await CategoriaModel.findOne().sort({ createdAt: 1, _id: 1 }).select("_id").lean();
  const categoryId = String((category as any)?._id || "").trim();

  if (!categoryId) {
    throw new Error("No existe ninguna categoria registrada para crear el producto temporal del paquete");
  }

  cachedTemporaryCategoryId = categoryId;
  return categoryId;
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
const normalizeTextLower = (value: unknown): string => normalizeTextValue(value).toLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeStatusValue = (value: unknown) => normalizeTextValue(value);
const normalizeBranchName = (value: unknown): string =>
  normalizeTextValue(value).toLowerCase().replace(/\s+/g, " ");

type DeliveryCutoffDayGroup = "weekdays" | "saturday" | "sunday";

const getDeliveryCutoffDayGroup = (date: moment.Moment): DeliveryCutoffDayGroup => {
  const day = date.day();
  if (day >= 1 && day <= 5) return "weekdays";
  if (day === 6) return "saturday";
  return "sunday";
};

const parseDeliveryTime = (value?: string | null) => {
  const [hoursRaw, minutesRaw] = String(value || "").split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
};

const buildMomentFromTime = (base: moment.Moment, value?: string | null) => {
  const { hours, minutes } = parseDeliveryTime(value);
  return base
    .clone()
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0);
};

const getBranchDeliveryCutoffConfig = (branch: any, date: moment.Moment) => {
  const dayGroup = getDeliveryCutoffDayGroup(date);
  const legacyRegistration = String(branch?.delivery_cutoff_start_time || branch?.delivery_cutoff_time || "").trim();
  const legacyClosing = String(branch?.delivery_cutoff_end_time || branch?.delivery_cutoff_time || "").trim();

  const configByGroup: Record<DeliveryCutoffDayGroup, { registrationTime: string; closingTime: string }> = {
    weekdays: {
      registrationTime: String(branch?.delivery_cutoff_weekdays_registration_time || legacyRegistration || "").trim(),
      closingTime: String(branch?.delivery_cutoff_weekdays_closing_time || legacyClosing || "").trim(),
    },
    saturday: {
      registrationTime: String(branch?.delivery_cutoff_saturday_registration_time || legacyRegistration || "").trim(),
      closingTime: String(branch?.delivery_cutoff_saturday_closing_time || legacyClosing || "").trim(),
    },
    sunday: {
      registrationTime: String(branch?.delivery_cutoff_sunday_registration_time || legacyRegistration || "").trim(),
      closingTime: String(branch?.delivery_cutoff_sunday_closing_time || legacyClosing || "").trim(),
    },
  };

  return {
    enabled: Boolean(branch?.delivery_cutoff_enabled),
    dayGroup,
    ...configByGroup[dayGroup],
  };
};

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

const isDeliveryLikeShipping = (shipping: any) =>
  String(shipping?.tipo_destino || "").trim().toLowerCase() === "otro_lugar" ||
  (String(shipping?.tipo_destino || "").trim().toLowerCase() !== "sucursal" &&
  Boolean(
    shipping?.costo_delivery ||
      shipping?.cargo_delivery ||
      shipping?.quien_paga_delivery ||
      shipping?.delivery_spaces
  ));

const validateDeliveryCutoff = async (shipping: any) => {
  if (!isDeliveryLikeShipping(shipping)) return;

  const branchId = resolveBranchId(shipping?.lugar_origen) || resolveBranchId(shipping?.sucursal);
  if (!branchId || !Types.ObjectId.isValid(branchId)) return;

  const branch = await SucursalModel.findById(branchId)
    .select(
      "nombre delivery_cutoff_enabled delivery_cutoff_weekdays_registration_time delivery_cutoff_weekdays_closing_time delivery_cutoff_saturday_registration_time delivery_cutoff_saturday_closing_time delivery_cutoff_sunday_registration_time delivery_cutoff_sunday_closing_time delivery_cutoff_start_time delivery_cutoff_end_time delivery_cutoff_time"
    )
    .lean();

  if (!branch?.delivery_cutoff_enabled) return;
  const now = moment().tz("America/La_Paz");

  const scheduledDelivery = shipping?.hora_entrega_acordada
    ? moment.tz(shipping.hora_entrega_acordada, "America/La_Paz")
    : null;
  const deliveryDate = scheduledDelivery?.isValid() ? scheduledDelivery : now;
  const cutoff = getBranchDeliveryCutoffConfig(branch, deliveryDate);
  if (!cutoff.registrationTime && !cutoff.closingTime) return;

  const registrationLimit = buildMomentFromTime(deliveryDate, cutoff.registrationTime || cutoff.closingTime || "00:00");
  const closingLimit = buildMomentFromTime(deliveryDate, cutoff.closingTime || cutoff.registrationTime || "00:00");
  const selectedDateIsToday = deliveryDate.format("YYYY-MM-DD") === now.format("YYYY-MM-DD");

  if (selectedDateIsToday && now.isAfter(registrationLimit)) {
    throw new Error(
      `La sucursal ${String(branch.nombre || branchId)} ya cerró el registro para hoy. Solo permite programar entregas para fechas futuras.`
    );
  }

  if (
    scheduledDelivery?.isValid() &&
    scheduledDelivery.isAfter(closingLimit)
  ) {
    throw new Error(
      `La entrega programada no puede superar la hora de cierre operativo (${closingLimit.format("HH:mm")}) de la sucursal ${String(branch.nombre || branchId)}.`
    );
  }
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

const resolveBranchReferenceId = async (value?: string | null): Promise<string> => {
  const safeValue = normalizeTextValue(value);
  if (!safeValue) return "";
  if (Types.ObjectId.isValid(safeValue)) return safeValue;
  const branchByName = await findBranchByName(safeValue);
  return resolveBranchId(branchByName?._id);
};

const resolveDeliveryBranchId = async (shipping: any): Promise<string> => {
  const simplePackageSourceId = String(shipping?.simple_package_source_id || "").trim();
  if (simplePackageSourceId) {
    const simplePackage = await SimplePackageRepository.getSimplePackageByID(simplePackageSourceId);
    const simplePackageDestinationId = resolveBranchId(
      (simplePackage as any)?.destino_sucursal?._id ?? (simplePackage as any)?.destino_sucursal
    );
    if (simplePackageDestinationId) return simplePackageDestinationId;
  }

  return resolvePaymentBranchId(shipping);
};

const getSimplePackageSource = async (shipping: any) => {
  const simplePackageSourceId = String(
    shipping?.simple_package_source_id?._id || shipping?.simple_package_source_id || ""
  ).trim();
  if (!simplePackageSourceId) return null;
  return await SimplePackageRepository.getSimplePackageByID(simplePackageSourceId);
};

const resolveSimplePackageDestination = async (shipping: any) => {
  const simplePackage = await getSimplePackageSource(shipping);
  if (!simplePackage) return null;

  const destinationBranchId = resolveBranchId(
    (simplePackage as any)?.destino_sucursal?._id ?? (simplePackage as any)?.destino_sucursal
  );
  const destinationBranchName = normalizeTextValue(
    (simplePackage as any)?.destino_sucursal?.nombre ?? (simplePackage as any)?.lugar_entrega
  );

  if (!destinationBranchId) return null;
  return {
    id: destinationBranchId,
    name: destinationBranchName,
  };
};

const canMarkDeliveredFromBranch = async (shipping: any, branchId?: string | null): Promise<boolean> => {
  const currentBranchId = await resolveBranchReferenceId(branchId);
  if (!currentBranchId) return true;
  const deliveryBranchId = await resolveDeliveryBranchId(shipping);
  return !deliveryBranchId || deliveryBranchId === currentBranchId;
};

const isBranchTransferShipping = async (shipping: any): Promise<boolean> => {
  const originId = resolveOriginBranchId(shipping);
  const destinationId = await resolveDeliveryBranchId(shipping);
  return Boolean(originId && destinationId && originId !== destinationId);
};

const resolveStorageFeeStartForShipping = async (shipping: any) => {
  if (!(await isBranchTransferShipping(shipping))) return shipping?.fecha_pedido;
  if (shipping?.public_tracking_frozen === true) return null;
  return resolveBranchPickupFeeStart(shipping);
};

const resolveLatePickupFeeForShippingDelivery = async (shipping: any, pickedUpAt: unknown) => {
  if (shipping?.public_tracking_frozen === true) {
    return roundCurrency(Number(shipping?.late_pickup_fee || 0));
  }

  return calculateLatePickupFee({
    startAt: await resolveStorageFeeStartForShipping(shipping),
    pickedUpAt: pickedUpAt || new Date(),
  });
};

const getSimplePackageMethodFromShipping = (shipping: any): "" | "efectivo" | "qr" => {
  if (Number(shipping?.subtotal_qr || 0) > 0) return "qr";
  if (Number(shipping?.subtotal_efectivo || 0) > 0) return "efectivo";
  const normalizedType = String(shipping?.tipo_de_pago || "").trim().toLowerCase();
  if (normalizedType === "1" || normalizedType === "transferencia o qr") return "qr";
  if (normalizedType === "2" || normalizedType === "efectivo") return "efectivo";
  return "";
};

const roundCurrency = (value: number): number => +Number(value || 0).toFixed(2);
const isSameBusinessDay = (value: unknown) => {
  const date = moment.tz(value as any, "America/La_Paz");
  return date.isValid() && date.isSame(moment.tz("America/La_Paz"), "day");
};

const getExternalBuyerChargeAmount = (sale: any): number =>
  roundCurrency(
    Number(
      sale?.deuda_comprador ??
        sale?.monto_paga_comprador ??
        sale?.saldo_cobrar ??
        0
    )
  );

const getExternalDeliveredPaymentTotals = (sale: any) => {
  const buyerAmount = getExternalBuyerChargeAmount(sale);
  const subtotalQr = roundCurrency(Number(sale?.subtotal_qr || 0));
  const subtotalEfectivo = roundCurrency(Number(sale?.subtotal_efectivo || 0));

  if (subtotalQr > 0 || subtotalEfectivo > 0) {
    return {
      subtotalQr,
      subtotalEfectivo,
      montoTotal: roundCurrency(subtotalQr + subtotalEfectivo),
    };
  }

  return {
    subtotalQr: 0,
    subtotalEfectivo: buyerAmount,
    montoTotal: buyerAmount,
  };
};

const getExternalSellerPaymentTotals = (sale: any) => {
  if (String(sale?.service_origin || "").trim() === "simple_package" && sale?.is_external !== true) {
    return {
      subtotalQr: 0,
      subtotalEfectivo: 0,
      montoTotal: 0,
      tipoDePago: "No pagado",
    };
  }

  const amount = roundCurrency(Number(sale?.monto_paga_vendedor || sale?.amortizacion_vendedor || 0));
  const method = String(sale?.metodo_pago || "").trim().toLowerCase();

  if (amount <= 0 || !method) {
    return {
      subtotalQr: 0,
      subtotalEfectivo: 0,
      montoTotal: 0,
      tipoDePago: "No pagado",
    };
  }

  if (method === "qr") {
    return {
      subtotalQr: amount,
      subtotalEfectivo: 0,
      montoTotal: amount,
      tipoDePago: "Pago vendedor QR",
    };
  }

  return {
    subtotalQr: 0,
    subtotalEfectivo: amount,
    montoTotal: amount,
    tipoDePago: "Pago vendedor efectivo",
  };
};

const isDateInSalesHistoryRange = (
  value: any,
  periodStart: Date,
  periodEnd: Date,
  exclusiveStart: boolean
) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (exclusiveStart ? date > periodStart : date >= periodStart) && date <= periodEnd;
};

const getSimplePackageBalanceToApply = async (
  shipping: any
): Promise<{ sellerId: string; amount: number } | null> => {
  const simplePackageSourceId = String(
    shipping?.simple_package_source_id?._id ||
      shipping?.simple_package_source_id ||
      ""
  ).trim();

  if (!simplePackageSourceId) return null;

  const simplePackage = await SimplePackageRepository.getSimplePackageByID(simplePackageSourceId);
  if (!simplePackage) return null;

  const sellerId = String((simplePackage as any)?.id_vendedor || "").trim();
  const amount = roundCurrency(Number((simplePackage as any)?.amortizacion_vendedor || 0));

  if (!sellerId || amount <= 0) return null;

  return { sellerId, amount };
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

type ShippingDashboardTab = "todos" | "En Espera" | "para_enviar" | "en_camino" | "entregado";
type ShippingDashboardCategory = "all" | "externos" | "paquetes";

type ShippingDashboardParams = {
  page?: number;
  limit?: number;
  tab?: ShippingDashboardTab;
  category?: ShippingDashboardCategory;
  from?: Date;
  to?: Date;
  currentBranchId?: string;
  ignoreBranchVisibility?: boolean;
  sellerId?: string;
  client?: string;
  guide?: string;
  destinationMode?: "any" | "branch" | "other";
  destinationQuery?: string;
};

const resolveInternalOriginBranchId = (row: any) =>
  normalizeTextValue(row?.lugar_origen?._id || row?.lugar_origen || row?.origen_sucursal?._id || row?.origen_sucursal);

const resolveInternalDestinationBranchId = (row: any) =>
  normalizeTextValue(row?.sucursal?._id || row?.sucursal || row?.destino_sucursal?._id || row?.destino_sucursal);

const resolveExternalOriginBranchId = (row: any) =>
  normalizeTextValue(row?.origen_sucursal?._id || row?.origen_sucursal || row?.sucursal?._id || row?.sucursal);

const resolveExternalDestinationBranchId = (row: any) =>
  normalizeTextValue(row?.destino_sucursal?._id || row?.destino_sucursal || row?.sucursal?._id || row?.sucursal);

const isInternalSaleLike = (row: any) => normalizeStatusValue(row?.estado_pedido).toLowerCase() === INTERNAL_SALE_STATUS;

const isSimplePackageLike = (row: any) =>
  Boolean(row?.simple_package_order || row?.simple_package_source_id || normalizeTextLower(row?.service_origin) === "simple_package");

const matchesDashboardCategory = (
  row: any,
  source: "shipping" | "external",
  category: ShippingDashboardCategory
) => {
  if (category === "all") return true;
  if (source === "external") {
    return category === "externos";
  }
  const isPackage = isSimplePackageLike(row);
  if (category === "paquetes") return isPackage;
  return !isPackage;
};

const isRegularInternalOrderLike = (row: any) => !isInternalSaleLike(row) && !isSimplePackageLike(row);

const getScheduledMomentLike = (row: any) => {
  const value = row?.hora_entrega_acordada;
  if (!value) return null;
  const parsed = moment.parseZone(value);
  return parsed.isValid() ? parsed : null;
};

const shouldDisplayAsInTransitLike = (row: any, now: moment.Moment) => {
  const status = normalizeStatusValue(row?.estado_pedido);
  if (status === IN_TRANSIT_STATUS) return true;
  if (status !== WAITING_RAW_STATUS) return false;
  if (!isRegularInternalOrderLike(row)) return false;

  const scheduledAt = getScheduledMomentLike(row);
  if (!scheduledAt) return false;

  return now.isSameOrAfter(scheduledAt.clone().subtract(VISUAL_IN_TRANSIT_THRESHOLD_MINUTES, "minutes"));
};

const matchesDestinationFilter = (row: any, params: ShippingDashboardParams, knownBranchNames: Set<string>) => {
  const mode = params.destinationMode || "any";
  const query = normalizeTextLower(params.destinationQuery);
  const destination = normalizeTextValue(row?.lugar_entrega);
  const normalizedDestination = normalizeTextLower(destination);

  if (mode === "any") return true;
  if (mode === "branch") {
    if (!query) return true;
    return normalizedDestination.includes(query);
  }

  const isKnownBranch = knownBranchNames.has(normalizedDestination);
  if (isKnownBranch) return false;
  if (!query) return true;
  return normalizedDestination.includes(query);
};

const collectSellerIdsFromShippingLike = (row: any): string[] => {
  const ids = new Set<string>();

  (Array.isArray(row?.venta) ? row.venta : []).forEach((sale: any) => {
    const sellerId =
      sale?.id_vendedor ||
      (typeof sale?.vendedor === "object" ? sale?.vendedor?._id : sale?.vendedor);
    const normalized = normalizeTextValue(sellerId);
    if (normalized) ids.add(normalized);
  });

  (Array.isArray(row?.productos_temporales) ? row.productos_temporales : []).forEach((item: any) => {
    const normalized = normalizeTextValue(item?.id_vendedor);
    if (normalized) ids.add(normalized);
  });

  return Array.from(ids);
};

const classifyDashboardRow = (
  row: any,
  source: "shipping" | "external",
  currentBranchId: string,
  now: moment.Moment,
  ignoreBranchVisibility = false
) => {
  const isExternal = source === "external";
  const status = normalizeStatusValue(row?.estado_pedido);
  const isAnnulled = isExternal && (Boolean(row?.anulado) || status === "Anulado");
  const delivered = isAnnulled || status === "Entregado";
  const originId = isExternal ? resolveExternalOriginBranchId(row) : resolveInternalOriginBranchId(row);
  const destinationId = isExternal ? resolveExternalDestinationBranchId(row) : resolveInternalDestinationBranchId(row);
  const related = ignoreBranchVisibility
    ? true
    : Boolean(
        currentBranchId &&
        (originId === currentBranchId || destinationId === currentBranchId)
      );
  const interbranch = Boolean(originId && destinationId && originId !== destinationId);
  const branchTransferManaged = isExternal || isSimplePackageLike(row);
  const pendingSend =
    !isAnnulled &&
    status === SEND_TO_BRANCH_STATUS &&
    branchTransferManaged &&
    interbranch &&
    (ignoreBranchVisibility || originId === currentBranchId);
  const inTransit =
    !isAnnulled &&
    !pendingSend &&
    ((status === IN_TRANSIT_STATUS &&
      (ignoreBranchVisibility
        ? true
        : branchTransferManaged
        ? destinationId === currentBranchId || originId === currentBranchId
        : true)) ||
      shouldDisplayAsInTransitLike(row, now));
  const ready =
    !isAnnulled &&
    !delivered &&
    !pendingSend &&
    !inTransit &&
    (status === WAITING_RAW_STATUS || status === READY_FOR_PICKUP_VISUAL_STATUS);
  const visibleInAll = !isAnnulled && !delivered && (ignoreBranchVisibility || related);

  return {
    source,
    rowId: String(row?._id || ""),
    related,
    delivered,
    pendingSend,
    inTransit,
    ready,
    all: visibleInAll,
    sortAt: (row?.hora_entrega_acordada || row?.fecha_pedido || row?.hora_entrega_real || new Date()).toString(),
    isExternal,
  };
};

const mapExternalRowToShippingShape = (externalSale: any) => {
  const estaPagado =
    externalSale?.esta_pagado === "mixto"
      ? "mixto"
      : externalSale?.esta_pagado === "si"
      ? "si"
      : "no";
  const precioPaquete = Number(externalSale?.precio_paquete ?? externalSale?.precio_total ?? 0);
  const pagaComprador = Number(externalSale?.monto_paga_comprador ?? 0);
  const fechaBase = externalSale?.fecha_pedido || new Date().toISOString();
  const sucursalOrigen =
    typeof externalSale?.origen_sucursal === "object"
      ? externalSale.origen_sucursal
      : typeof externalSale?.sucursal === "object"
      ? externalSale.sucursal
      : null;
  const destinationLabel =
    externalSale?.lugar_entrega ||
    externalSale?.destino_sucursal?.nombre ||
    sucursalOrigen?.nombre ||
    (externalSale?.service_origin === "simple_package" ? "Simple" : "Externo");

  return {
    ...externalSale,
    key: `external-${externalSale._id}`,
    is_external: true,
    cliente: externalSale?.comprador || "Sin comprador",
    telefono_cliente: externalSale?.telefono_comprador || "",
    carnet_cliente: externalSale?.carnet_comprador || "",
    hora_entrega_acordada: fechaBase,
    hora_entrega_real: externalSale?.hora_entrega_real || fechaBase,
    lugar_origen: sucursalOrigen,
    lugar_entrega: destinationLabel,
    id_sucursal: sucursalOrigen?._id || externalSale?.origen_sucursal || externalSale?.sucursal || externalSale?.id_sucursal,
    sucursal: sucursalOrigen,
    estado_pedido: externalSale?.anulado
      ? "Anulado"
      : normalizeStatusValue(externalSale?.estado_pedido || (externalSale?.delivered ? "Entregado" : WAITING_RAW_STATUS)),
    esta_pagado: estaPagado,
    saldo_cobrar: Number(
      externalSale?.deuda_comprador ??
        externalSale?.saldo_cobrar ??
        (estaPagado === "si" ? 0 : estaPagado === "mixto" ? pagaComprador : precioPaquete)
    ),
    numero_guia: externalSale?.numero_guia || "",
    observaciones: externalSale?.descripcion_paquete || "",
    venta: [],
    productos_temporales: [],
  };
};

const normalizeShippingBranches = async (payload: any, currentShipping?: any) => {
  const originId = resolveBranchId(
    payload?.lugar_origen ?? currentShipping?.lugar_origen
  );
  const requestedDestinationBranchId = resolveBranchId(
    payload?.destino_sucursal_id ?? payload?.destino_sucursal
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
    : (requestedDestinationBranchId || (requestedPaymentBranchId && requestedPaymentBranchId !== originId) || legacyDestinationBranchId
      ? "sucursal"
      : "otro_lugar");
  const destinationBranchId =
    destinationType === "sucursal"
      ? (
        requestedDestinationBranchId ||
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
  guide?: string;
}) => {
  const result = await ShippingRepository.findList(params);
  return {
    ...result,
    rows: await attachSimplePackageFieldsToShippings(result.rows || []),
  };
};

const getShippingDashboardList = async (params: ShippingDashboardParams) => {
  const safePage = Math.max(1, Number(params.page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(params.limit) || 30));
  const currentBranchId = normalizeTextValue(params.currentBranchId);
  const category = (params.category || "all") as ShippingDashboardCategory;
  const ignoreBranchVisibility = Boolean(params.ignoreBranchVisibility);
  const debugSeller = ignoreBranchVisibility || Boolean(params.sellerId);
  const now = moment().tz("America/La_Paz");
  const tab = (params.tab || "todos") as ShippingDashboardTab;
  const knownBranchNames = new Set(
    (
      await SucursalModel.find({}, { nombre: 1 }).lean()
    ).map((row: any) => normalizeTextLower(row?.nombre)).filter(Boolean)
  );

  const internalFilter: any = {
    estado_pedido: { $ne: INTERNAL_SALE_STATUS },
  };
  const vendorOptionsInternalFilter: any = {
    estado_pedido: { $ne: INTERNAL_SALE_STATUS },
  };
  const externalFilter: any = {
    $or: [
      { service_origin: { $exists: false } },
      { service_origin: "external" },
    ],
  };

  if (params.from || params.to) {
    internalFilter.hora_entrega_acordada = {};
    vendorOptionsInternalFilter.hora_entrega_acordada = {};
    externalFilter.fecha_pedido = {};
    if (params.from) {
      internalFilter.hora_entrega_acordada.$gte = params.from;
      vendorOptionsInternalFilter.hora_entrega_acordada.$gte = params.from;
      externalFilter.fecha_pedido.$gte = params.from;
    }
    if (params.to) {
      internalFilter.hora_entrega_acordada.$lte = params.to;
      vendorOptionsInternalFilter.hora_entrega_acordada.$lte = params.to;
      externalFilter.fecha_pedido.$lte = params.to;
    }
  }

  if (!ignoreBranchVisibility && currentBranchId && Types.ObjectId.isValid(currentBranchId)) {
    const branchObjectId = new Types.ObjectId(currentBranchId);
    internalFilter.$and = [
      ...(internalFilter.$and || []),
      {
        $or: [
          { lugar_origen: branchObjectId },
          { sucursal: branchObjectId },
        ],
      },
    ];
    vendorOptionsInternalFilter.$and = [
      ...(vendorOptionsInternalFilter.$and || []),
      {
        $or: [
          { lugar_origen: branchObjectId },
          { sucursal: branchObjectId },
        ],
      },
    ];
    externalFilter.$and = [
      ...(externalFilter.$and || []),
      {
        $or: [
          { origen_sucursal: branchObjectId },
          { destino_sucursal: branchObjectId },
          { sucursal: branchObjectId },
        ],
      },
    ];
  }

  if (params.client) {
    const searchRegex = new RegExp(escapeRegex(params.client), "i");
    const clientMatch = {
      $or: [
        { cliente: searchRegex },
        { telefono_cliente: searchRegex },
        { carnet_cliente: searchRegex },
        { numero_guia: searchRegex },
      ],
    };
    internalFilter.$and = [...(internalFilter.$and || []), clientMatch];
    vendorOptionsInternalFilter.$and = [...(vendorOptionsInternalFilter.$and || []), clientMatch];
    externalFilter.$and = [
      ...(externalFilter.$and || []),
      {
        $or: [
          { comprador: searchRegex },
          { telefono_comprador: searchRegex },
          { carnet_comprador: searchRegex },
          { numero_guia: searchRegex },
        ],
      },
    ];
  }

  if (params.guide) {
    const guideRegex = new RegExp(escapeRegex(params.guide), "i");
    internalFilter.$and = [...(internalFilter.$and || []), { numero_guia: guideRegex }];
    vendorOptionsInternalFilter.$and = [...(vendorOptionsInternalFilter.$and || []), { numero_guia: guideRegex }];
    externalFilter.$and = [...(externalFilter.$and || []), { numero_guia: guideRegex }];
  }

  const sellerId = normalizeTextValue(params.sellerId);
  let salesPedidoIds: any[] = [];
  if (sellerId === "__EXTERNO__") {
    internalFilter.$and = [...(internalFilter.$and || []), { _id: { $in: [] } }];
  } else if (sellerId && Types.ObjectId.isValid(sellerId)) {
    const sellerObjectId = new Types.ObjectId(sellerId);
    const pedidoIdsBySales = await VentaModel.find({
      $or: [
        { vendedor: sellerObjectId },
        { id_vendedor: sellerObjectId },
      ],
    }).select("pedido").lean();
    salesPedidoIds = pedidoIdsBySales.map((item: any) => item.pedido).filter(Boolean);
    internalFilter.$and = [
      ...(internalFilter.$and || []),
      {
        $or: [
          { _id: { $in: salesPedidoIds } },
          { "productos_temporales.id_vendedor": sellerObjectId },
        ],
      },
    ];
    externalFilter.$and = [...(externalFilter.$and || []), { _id: { $in: [] } }];
  }

  const [internalRowsLight, vendorOptionsInternalRowsLight, externalRowsLight] = await Promise.all([
    PedidoModel.find(internalFilter)
      .select("_id estado_pedido hora_entrega_acordada fecha_pedido lugar_origen sucursal simple_package_order simple_package_source_id lugar_entrega venta.vendedor venta.id_vendedor productos_temporales.id_vendedor")
      .sort({ hora_entrega_acordada: -1, _id: -1 })
      .lean(),
    PedidoModel.find(vendorOptionsInternalFilter)
      .select("_id estado_pedido hora_entrega_acordada fecha_pedido lugar_origen sucursal simple_package_order simple_package_source_id lugar_entrega venta.vendedor venta.id_vendedor productos_temporales.id_vendedor")
      .sort({ hora_entrega_acordada: -1, _id: -1 })
      .lean(),
    VentaExternaModel.find(externalFilter)
      .select("_id estado_pedido anulado fecha_pedido hora_entrega_real origen_sucursal destino_sucursal sucursal service_origin lugar_entrega")
      .sort({ fecha_pedido: -1, _id: -1 })
      .lean(),
  ]);

  if (debugSeller) {
    console.log("[shipping-dashboard][service][input]", {
      sellerId,
      currentBranchId,
      ignoreBranchVisibility,
      category,
      tab,
      from: params.from || null,
      to: params.to || null,
      destinationMode: params.destinationMode || "any",
      destinationQuery: params.destinationQuery || "",
      client: params.client || "",
      guide: params.guide || "",
      salesPedidoIdsCount: salesPedidoIds.length,
      salesPedidoIdsSample: salesPedidoIds.slice(0, 10).map((id: any) => String(id)),
      internalRowsLight: internalRowsLight.length,
      vendorOptionsInternalRowsLight: vendorOptionsInternalRowsLight.length,
      externalRowsLight: externalRowsLight.length,
    });
  }

  const classifiedInternal = internalRowsLight
    .filter((row: any) => matchesDashboardCategory(row, "shipping", category))
    .filter((row: any) => matchesDestinationFilter(row, params, knownBranchNames))
    .map((row: any) => classifyDashboardRow(row, "shipping", currentBranchId, now, ignoreBranchVisibility));
  const classifiedExternal = externalRowsLight
    .filter((row: any) => matchesDashboardCategory(row, "external", category))
    .filter((row: any) => matchesDestinationFilter(row, params, knownBranchNames))
    .map((row: any) => classifyDashboardRow(row, "external", currentBranchId, now, ignoreBranchVisibility));
  const classifiedVendorOptionsInternal = vendorOptionsInternalRowsLight
    .filter((row: any) => matchesDashboardCategory(row, "shipping", category))
    .filter((row: any) => matchesDestinationFilter(row, params, knownBranchNames))
    .map((row: any) => ({
      row,
      classified: classifyDashboardRow(row, "shipping", currentBranchId, now, ignoreBranchVisibility),
    }));

  const allClassified = [...classifiedInternal, ...classifiedExternal]
    .filter((row) => ignoreBranchVisibility || row.related)
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

  const counts = {
    todos: allClassified.filter((row) => row.all).length,
    listo_para_recoger: allClassified.filter((row) => row.ready).length,
    para_enviar: allClassified.filter((row) => row.pendingSend).length,
    en_camino: allClassified.filter((row) => row.inTransit).length,
    entregado: allClassified.filter((row) => row.delivered).length,
  };

  const tabRows = allClassified.filter((row) => {
    if (tab === "todos") return row.all;
    if (tab === "En Espera") return row.ready;
    if (tab === "para_enviar") return row.pendingSend;
    if (tab === "en_camino") return row.inTransit;
    return row.delivered;
  });
  const vendorIds = Array.from(
    new Set(
      classifiedVendorOptionsInternal
        .filter(({ classified }) => ignoreBranchVisibility || classified.related)
        .filter(({ classified }) => {
          if (tab === "todos") return classified.all;
          if (tab === "En Espera") return classified.ready;
          if (tab === "para_enviar") return classified.pendingSend;
          if (tab === "en_camino") return classified.inTransit;
          return classified.delivered;
        })
        .flatMap(({ row }) => collectSellerIdsFromShippingLike(row))
    )
  );

  const pageSlice = tabRows.slice((safePage - 1) * safeLimit, safePage * safeLimit);
  const pageInternalIds = pageSlice.filter((row) => row.source === "shipping").map((row) => row.rowId);
  const pageExternalIds = pageSlice.filter((row) => row.source === "external").map((row) => row.rowId);

  const [internalFullRows, externalFullRows] = await Promise.all([
    pageInternalIds.length
      ? attachSimplePackageFieldsToShippings(await ShippingRepository.findByIds(pageInternalIds))
      : Promise.resolve([]),
    pageExternalIds.length
      ? VentaExternaModel.find({ _id: { $in: pageExternalIds.map((id) => new Types.ObjectId(id)) } })
          .populate({ path: "sucursal", select: "_id nombre" })
          .populate({ path: "origen_sucursal", select: "_id nombre" })
          .populate({ path: "destino_sucursal", select: "_id nombre" })
          .lean()
      : Promise.resolve([]),
  ]);

  const rowMap = new Map<string, any>();
  internalFullRows.forEach((row: any) => {
    const base =
      typeof row?.toObject === "function"
        ? row.toObject()
        : { ...row };

    rowMap.set(`shipping:${String(row?._id)}`, {
      ...base,
      key: String(row?._id || ""),
      is_external: false,
    });
  });
  externalFullRows.forEach((row: any) => {
    rowMap.set(`external:${String(row?._id)}`, mapExternalRowToShippingShape(row));
  });

  const rows = pageSlice
    .map((row) => rowMap.get(`${row.source}:${row.rowId}`))
    .filter(Boolean);

  if (debugSeller) {
    console.log("[shipping-dashboard][service][classified]", {
      classifiedInternal: classifiedInternal.length,
      classifiedExternal: classifiedExternal.length,
      allClassified: allClassified.length,
      counts,
      vendorIdsCount: vendorIds.length,
      tabRows: tabRows.length,
      pageSlice: pageSlice.length,
      pageInternalIds: pageInternalIds.length,
      pageExternalIds: pageExternalIds.length,
      pageRowIds: pageSlice.map((row) => `${row.source}:${row.rowId}`),
      finalRows: rows.length,
      finalRowIds: rows.map((row: any) => String(row?.key || row?._id || "")),
    });
  }

  return {
    rows,
    counts,
    vendorIds,
    total: tabRows.length,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(tabRows.length / safeLimit)),
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
  if (shipping?.simple_package_order === true && !normalizeTextValue(shipping?.telefono_cliente)) {
    throw new Error("Debe ingresar el celular del comprador");
  }

  normalizeOrderPaymentData(shipping);
  await normalizeShippingBranches(shipping);
  await validateDeliveryCutoff(shipping);
  if (shipping?.simple_package_order === true) {
    await OrderGuideService.assignOrderGuide(shipping);
  }

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

const READY_FOR_PICKUP_STATUS = "LISTO PARA RECOGER";
const SEND_TO_BRANCH_STATUS = "PARA ENVIAR A OTRA SUCURSAL";

const allowedShippingTransitions: Record<string, string[]> = {
  "En Espera": ["En camino", READY_FOR_PICKUP_STATUS, "Entregado", "No entregado", "Cancelado"],
  [READY_FOR_PICKUP_STATUS]: ["Entregado", "Cancelado"],
  [SEND_TO_BRANCH_STATUS]: ["En camino", "Cancelado"],
  "En camino": [READY_FOR_PICKUP_STATUS, "Entregado", "No entregado", "Cancelado"],
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
  assertEditableIfNotDeliveredOlderThanFiveDays(shipping as any);
  if (
    (shipping as any)?.origen_pedido === "catalogo" &&
    ["Rechazado", "Cancelado", "No entregado"].includes(String(newData?.estado_pedido || ""))
  ) {
    throw new Error("Los pedidos de catalogo deben rechazarse con la accion Rechazar");
  }

  const isSimplePackageOrder =
    Boolean((shipping as any)?.simple_package_order) ||
    Boolean((shipping as any)?.simple_package_source_id);
  const simplePackageDestinationEditRequested =
    isSimplePackageOrder &&
    (
      Object.prototype.hasOwnProperty.call(newData, "destino_sucursal_id") ||
      Object.prototype.hasOwnProperty.call(newData, "destino_sucursal")
    );

  if (simplePackageDestinationEditRequested && !isSameBusinessDay((shipping as any)?.fecha_pedido)) {
    throw new Error("Solo se puede cambiar la sucursal destino el mismo dia que se creo el pedido");
  }

  normalizeOrderPaymentData(newData, shipping);
  await normalizeShippingBranches(newData, shipping);
  const simplePackageDestination = isSimplePackageOrder
    ? simplePackageDestinationEditRequested
      ? null
      : await resolveSimplePackageDestination(shipping)
    : null;

  if (simplePackageDestination?.id) {
    newData.tipo_destino = "sucursal";
    newData.sucursal = simplePackageDestination.id;
    newData.lugar_entrega = simplePackageDestination.name || newData.lugar_entrega;
  }

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

  if (willBeDelivered && !(await canMarkDeliveredFromBranch(nextShippingState, options?.currentBranchId))) {
    throw new Error("Solo la sucursal destino puede marcar este pedido como entregado");
  }

  let latePickupFee = 0;
  if (willBeDelivered && !wasDelivered && isSimplePackageOrder) {
    latePickupFee = await resolveLatePickupFeeForShippingDelivery(
      nextShippingState,
      newData.hora_entrega_real || new Date()
    );

    if (latePickupFee > 0) {
      const adjustedPayment = addLatePickupFeeToPayment({
        fee: latePickupFee,
        paymentType: newData.tipo_de_pago,
        subtotalQr: newData.subtotal_qr,
        subtotalEfectivo: newData.subtotal_efectivo,
      });
      newData.subtotal_qr = roundCurrency(adjustedPayment.subtotalQr);
      newData.subtotal_efectivo = roundCurrency(adjustedPayment.subtotalEfectivo);
      newData.late_pickup_fee = latePickupFee;
    }
  }

  if (willBeDelivered && !wasDelivered) {
    const sales = await SaleService.getSalesByShippingId(shippingId);
    const fallbackTemporarySales = (Array.isArray((shipping as any)?.productos_temporales) ? (shipping as any).productos_temporales : [])
      .filter((prod: any) => prod?.id_vendedor)
      .map((prod: any, index: number) => ({
        key: `fallback-temp-${index}`,
        producto: prod.producto,
        cantidad: Number(prod.cantidad || 1),
        precio_unitario: Number(prod.precio_unitario || 0),
        utilidad: Number(prod.utilidad || 0),
        id_vendedor: prod.id_vendedor,
        id_pedido: shippingId,
        id_sucursal: simplePackageDestination?.id ?? (shipping as any)?.sucursal ?? (shipping as any)?.lugar_origen ?? null,
        deposito_realizado: false,
        esTemporal: true,
      }));
    const salesForBalance = sales.length > 0 ? sales : fallbackTemporarySales;

    if (isSimplePackageOrder) {
      const balanceToApply = await getSimplePackageBalanceToApply(shipping);
      const simplePackageSource = await getSimplePackageSource(shipping);
      const previousApplied = roundCurrency(Number((simplePackageSource as any)?.seller_balance_applied_amount || 0));
      const nextApplied =
        balanceToApply && !newData.pagado_al_vendedor
          ? roundCurrency(Number(balanceToApply.amount || 0))
          : 0;
      const delta = roundCurrency(nextApplied - previousApplied);

      if (balanceToApply?.sellerId && delta !== 0) {
        await VendedorModel.findByIdAndUpdate(balanceToApply.sellerId, {
          $inc: { saldo_pendiente: delta },
        });
      }
    } else {
      // Regular packages: update using the standard balance calculation
      const salesToUpdateSaldo: any = [];
      
      salesForBalance.forEach((sale: any) => {
        if (!sale?.id_vendedor) {
          return;
        }
        const subtotal = sale.cantidad * sale.precio_unitario;
        salesToUpdateSaldo.push({
          id_vendedor: sale.id_vendedor.toString(),
          utilidad: sale.utilidad,
          id_pedido: sale.id_pedido || shippingId,
          subtotal: newData.pagado_al_vendedor ? 0 : subtotal,
          pagado_al_vendedor: !!newData.pagado_al_vendedor,
        });
      });

      if (salesToUpdateSaldo.length > 0) {
        await actualizarSaldoVendedor(salesToUpdateSaldo);
      }
    }
  }

  if (isSimplePackageOrder && wasDelivered && !willBeDelivered) {
    const simplePackageSource = await getSimplePackageSource(shipping);
    const previousApplied = roundCurrency(Number((simplePackageSource as any)?.seller_balance_applied_amount || 0));
    const sellerId = String((simplePackageSource as any)?.id_vendedor || "").trim();

    if (sellerId && previousApplied > 0) {
      await VendedorModel.findByIdAndUpdate(sellerId, {
        $inc: { saldo_pendiente: -previousApplied },
      });
    }
  }

  const resShip = await ShippingRepository.updateShipping(newData, shippingId);
  if (resShip) {
    void CatalogOrderIntegrationService.syncOrderStatus(
      typeof (resShip as any).toObject === "function" ? (resShip as any).toObject() : resShip
    );
  }

  if (resShip && toStatus === READY_FOR_PICKUP_STATUS && toStatus !== fromStatus) {
    void OrderGuideWhatsappService.sendPickupReadyMessage(resShip).catch((error) => {
      console.error("[shipping-service] pickup-whatsapp:error", {
        shippingId,
        error: error?.message || String(error),
      });
    });
  }

  const simplePackageSourceId = String(
    (resShip as any)?.simple_package_source_id ||
    (shipping as any)?.simple_package_source_id ||
    ""
  ).trim();

  if (resShip && simplePackageSourceId) {
    const nextStatus = String((resShip as any).estado_pedido || "").trim();
    const existingSource = await SimplePackageRepository.getSimplePackageByID(simplePackageSourceId);
    const sellerAppliedAmount =
      nextStatus === "Entregado"
        ? roundCurrency(Number((existingSource as any)?.amortizacion_vendedor || 0))
        : 0;
    const destinationBranchId = resolveBranchId((resShip as any).sucursal);
    const simplePackageUpdatePayload = {
      estado_pedido: (resShip as any).estado_pedido,
      delivered: nextStatus === "Entregado",
      seller_balance_applied: nextStatus === "Entregado" && sellerAppliedAmount > 0,
      seller_balance_applied_amount: sellerAppliedAmount,
      esta_pagado: (String((resShip as any).esta_pagado || "").trim().toLowerCase() === "si" ? "si" : "no") as "si" | "no",
      metodo_pago: getSimplePackageMethodFromShipping(resShip),
      hora_entrega_real: (resShip as any).hora_entrega_real,
      public_tracking_ready_for_pickup_at:
        nextStatus === READY_FOR_PICKUP_STATUS
          ? (resShip as any).public_tracking_ready_for_pickup_at || moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss")
          : (resShip as any).public_tracking_ready_for_pickup_at,
      retirado_por_vendedor: (resShip as any).retirado_por_vendedor === true,
      seller_withdrawn_at: (resShip as any).seller_withdrawn_at,
      late_pickup_fee: (resShip as any).late_pickup_fee || 0,
      numero_guia: (resShip as any).numero_guia || "",
      guia_sequence: (resShip as any).guia_sequence,
      shipping_qr_code: (resShip as any).shipping_qr_code || "",
      shipping_qr_payload: (resShip as any).shipping_qr_payload || "",
      shipping_qr_image_path: (resShip as any).shipping_qr_image_path || "",
      ...(simplePackageDestinationEditRequested && destinationBranchId
        ? {
            destino_sucursal: Types.ObjectId.isValid(destinationBranchId)
              ? new Types.ObjectId(destinationBranchId)
              : undefined,
            lugar_entrega: (resShip as any).lugar_entrega || "",
          }
        : {}),
    };
    const lateFee = roundCurrency(Number((resShip as any).late_pickup_fee || 0));
    const simplePackageFinancialPatch =
      lateFee > 0
        ? {
            deuda_comprador: roundCurrency(Number((existingSource as any)?.deuda_comprador || 0) + lateFee),
            monto_paga_comprador: roundCurrency(Number((existingSource as any)?.monto_paga_comprador || 0) + lateFee),
            saldo_cobrar: roundCurrency(Number((existingSource as any)?.saldo_cobrar || 0) + lateFee),
          }
        : {};
    await SimplePackageRepository.updateSimplePackageByID(simplePackageSourceId, {
      ...simplePackageUpdatePayload,
      ...simplePackageFinancialPatch,
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
  assertEditableIfNotDeliveredOlderThanFiveDays(shipping as any);

  await PedidoModel.findByIdAndUpdate(shippingId, {
    $set: {
      productos_temporales: productosTemporales,
    },
  });
};

const deleteShippingById = async (id: string) => {
  const pedido = await PedidoModel.findById(id);
  if (!pedido) throw new Error("Pedido no encontrado");
  assertEditableIfNotDeliveredOlderThanFiveDays(pedido as any);

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
    const rawProductId =
      sale?.id_producto ??
      sale?.producto?._id ??
      sale?.producto?.id ??
      sale?.producto;
    let productId = String(rawProductId || "").trim();

    if (!Types.ObjectId.isValid(productId)) {
      const temporaryCategoryId = await resolveTemporaryCategoryId();
      const nuevoProducto = await ProductoModel.create({
        nombre_producto: sale.nombre_variante || sale.producto,
        id_vendedor: sale.id_vendedor,
        id_categoria: sale.id_categoria || temporaryCategoryId,
        categoria: sale.id_categoria || temporaryCategoryId,
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

      productId = String(nuevoProducto._id);
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
  fromLastClose = false,
  periodEndISO?: string
) => {
  const parseRawDate = (value?: string) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const startOfRawDay = (value: Date) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
  const endOfRawDay = (value: Date) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));

  const now = new Date();
  const baseDate = parseRawDate(date) || now;

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("Invalid date received for sales history");
  }

  const startOfDay = startOfRawDay(baseDate);
  const endOfSelectedDay = endOfRawDay(baseDate);
  const explicitPeriodEnd = parseRawDate(periodEndISO);
  const periodEnd = explicitPeriodEnd || (date ? endOfSelectedDay : now);

  const filter: any = {};
  let periodStart = startOfDay;

  const getHistoryDate = (pedido: any): Date => {
    const estado = String(pedido?.estado_pedido || "").trim().toLowerCase();
    if (estado === "interno") return pedido?.fecha_pedido;
    if (estado === "entregado") return pedido?.hora_entrega_real || pedido?.fecha_pedido;
    return pedido?.hora_entrega_acordada || pedido?.fecha_pedido;
  };

  const getExternalHistoryDate = (sale: any): Date => {
    const estado = String(sale?.estado_pedido || "").trim().toLowerCase();
    if (estado === "entregado" || sale?.delivered === true) {
      return sale?.hora_entrega_real || sale?.fecha_pedido;
    }
    return sale?.fecha_pedido;
  };
  const getExternalOriginBranchId = (sale: any): string =>
    String((sale?.sucursal as any)?._id || sale?.sucursal || (sale?.origen_sucursal as any)?._id || sale?.origen_sucursal || "").trim();
  const getExternalDestinationBranchId = (sale: any): string =>
    String((sale?.destino_sucursal as any)?._id || sale?.destino_sucursal || (sale?.sucursal as any)?._id || sale?.sucursal || "").trim();

  if (fromLastClose) {
    const lastClose = await BoxCloseRepository.findLatestBySucursalBefore(
      sucursalId,
      periodEnd
    );

    const lastCloseDate = lastClose?.closed_at || lastClose?.created_at
      ? new Date((lastClose?.closed_at || lastClose?.created_at) as Date)
      : null;
    periodStart = lastCloseDate && lastCloseDate > startOfDay
      ? lastCloseDate
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
    filter.$or = [
      {
        estado_pedido: "interno",
        fecha_pedido: { $gte: startOfDay, $lte: periodEnd },
      },
      {
        estado_pedido: "Entregado",
        hora_entrega_real: { $gte: startOfDay, $lte: periodEnd },
      },
    ];
  } else {
    filter.$or = [
      {
        estado_pedido: "interno",
        fecha_pedido: { $lte: new Date() },
      },
      {
        estado_pedido: "Entregado",
        hora_entrega_real: { $lte: new Date() },
      },
    ];
  }

  const pedidos = await PedidoModel.find(filter)
    .populate({
      path: 'venta',
      populate: [
        { path: 'vendedor', select: 'nombre apellido' },
        { path: 'producto', select: 'nombre_producto' }
      ]
    })
    .sort({ hora_entrega_real: -1, fecha_pedido: -1 })
    .lean();

  const pedidosWithSimplePackageDestination = await Promise.all(
    pedidos.map(async (pedido: any) => ({
      pedido,
      simplePackageDestination: (pedido as any)?.simple_package_order || (pedido as any)?.simple_package_source_id
        ? await resolveSimplePackageDestination(pedido)
        : null,
    }))
  );

  const pedidosFiltrados = pedidosWithSimplePackageDestination.filter(({ pedido, simplePackageDestination }) => {
    const estado = String(pedido?.estado_pedido || "").trim().toLowerCase();
    const paymentBranchId = simplePackageDestination?.id || resolvePaymentBranchId(pedido);
    const originBranchId = resolveOriginBranchId(pedido);

    if (estado === "interno") {
      return paymentBranchId === sucursalId || originBranchId === sucursalId;
    }

    return paymentBranchId === sucursalId;
  }).map(({ pedido }) => pedido);

  const externalCandidates = await ExternalSaleRepository.getExternalSalesHistoryCandidates(
    fromLastClose ? periodStart : (date ? startOfDay : undefined),
    periodEnd,
    sucursalId ? [sucursalId] : undefined
  );

  const externalFiltrados = externalCandidates.filter((sale: any) => {
    const currentBranchId = String(sucursalId || "").trim();
    const sellerPaymentBranchId = getExternalOriginBranchId(sale);
    const buyerPaymentBranchId = getExternalDestinationBranchId(sale);
    const sellerBranchMatches = sellerPaymentBranchId === currentBranchId;
    const buyerBranchMatches = buyerPaymentBranchId === currentBranchId;
    if (!sellerBranchMatches && !buyerBranchMatches) return false;

    const sellerPayment = getExternalSellerPaymentTotals(sale);
    const hasSellerPayment = sellerPayment.montoTotal > 0;
    const isDelivered = String(sale?.estado_pedido || "").trim().toLowerCase() === "entregado" || sale?.delivered === true;
    if (!(isDelivered && buyerBranchMatches) && !(hasSellerPayment && sellerBranchMatches)) return false;

    if (fromLastClose) {
      const deliveredDate = sale?.hora_entrega_real ? new Date(sale.hora_entrega_real) : null;
      const sellerPaymentDate = sale?.fecha_pedido ? new Date(sale.fecha_pedido) : null;
      if (sellerBranchMatches && hasSellerPayment && sellerPaymentDate && sellerPaymentDate > periodStart && sellerPaymentDate <= periodEnd) return true;
      if (buyerBranchMatches && isDelivered && deliveredDate && deliveredDate > periodStart && deliveredDate <= periodEnd) return true;

      const orderDate = sale?.fecha_pedido ? new Date(sale.fecha_pedido) : null;
      return buyerBranchMatches && isDelivered && !!orderDate && orderDate > periodStart && orderDate <= periodEnd;
    }

    if (date) {
      return (
        (sellerBranchMatches && hasSellerPayment && isDateInSalesHistoryRange(sale?.fecha_pedido, startOfDay, periodEnd, false)) ||
        (buyerBranchMatches && isDelivered && isDateInSalesHistoryRange(getExternalHistoryDate(sale), startOfDay, periodEnd, false))
      );
    }

    return true;
  });

  const resumenPedidos = pedidosFiltrados.map(p => {
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

    const ventasParaMontoTotal =
      (p as any)?.simple_package_order && ventasNormales.length > 0
        ? ventasNormales
        : [...ventasNormales, ...ventasTemporales];

    const montoBase = ventasParaMontoTotal.reduce(
      (acc: number, v: any) => acc + (v.precio_unitario * v.cantidad), 0
    );
    const montoTotal =
      (p as any)?.simple_package_order
        ? Number((p as any)?.subtotal_qr || 0) + Number((p as any)?.subtotal_efectivo || 0)
        : montoBase;

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

  const resumenExternas = externalFiltrados.flatMap((sale: any) => {
    const currentBranchId = String(sucursalId || "").trim();
    const sellerBranchMatches = getExternalOriginBranchId(sale) === currentBranchId;
    const buyerBranchMatches = getExternalDestinationBranchId(sale) === currentBranchId;
    const paymentTotals = getExternalDeliveredPaymentTotals(sale);
    const buyerAmount = paymentTotals.montoTotal;
    const sellerPaymentTotals = getExternalSellerPaymentTotals(sale);
    const isDelivered = String(sale?.estado_pedido || "").trim().toLowerCase() === "entregado" || sale?.delivered === true;
    const tipoDePago =
      String(sale?.tipo_de_pago || "").trim() ||
      (paymentTotals.subtotalQr > 0 && paymentTotals.subtotalEfectivo > 0
        ? "Efectivo + QR"
        : paymentTotals.subtotalQr > 0
          ? "Transferencia o QR"
          : "Efectivo");

    const rows: any[] = [];
    const shouldIncludeSellerPayment =
      sellerBranchMatches &&
      sellerPaymentTotals.montoTotal > 0 &&
      (fromLastClose
        ? isDateInSalesHistoryRange(sale?.fecha_pedido, periodStart, periodEnd, true)
        : date
          ? isDateInSalesHistoryRange(sale?.fecha_pedido, startOfDay, periodEnd, false)
          : true);
    const shouldIncludeBuyerPayment =
      buyerBranchMatches &&
      isDelivered &&
      buyerAmount > 0 &&
      (fromLastClose
        ? isDateInSalesHistoryRange(getExternalHistoryDate(sale), periodStart, periodEnd, true)
        : date
          ? isDateInSalesHistoryRange(getExternalHistoryDate(sale), startOfDay, periodEnd, false)
          : true);

    if (shouldIncludeSellerPayment) {
      rows.push({
        _id: `${sale._id}-seller-payment`,
        external_sale_id: sale._id,
        payment_kind: "seller",
        fecha: sale.fecha_pedido,
        hora: dayjs(sale.fecha_pedido).format("HH:mm"),
        tipo_de_pago: sellerPaymentTotals.tipoDePago,
        monto_total: sellerPaymentTotals.montoTotal,
        subtotal_efectivo: sellerPaymentTotals.subtotalEfectivo,
        subtotal_qr: sellerPaymentTotals.subtotalQr,
        esta_pagado: sale.esta_pagado,
        is_external: true,
      });
    }

    if (shouldIncludeBuyerPayment) {
      rows.push({
        _id: `${sale._id}-buyer-payment`,
        external_sale_id: sale._id,
        payment_kind: "buyer",
        fecha: getExternalHistoryDate(sale),
        hora: dayjs(getExternalHistoryDate(sale)).format("HH:mm"),
        tipo_de_pago: tipoDePago,
        monto_total: buyerAmount,
        subtotal_efectivo: paymentTotals.subtotalEfectivo,
        subtotal_qr: paymentTotals.subtotalQr,
        esta_pagado: sale.esta_pagado,
        is_external: true,
      });
    }

    return rows;
  });

  const resumen = [...resumenPedidos, ...resumenExternas].sort(
    (a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  const totales = resumen.reduce((acc: { efectivo: number; qr: number }, curr: any) => {
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

  return {
    shippingId,
    shippingQrCode: shipping.shipping_qr_code || "",
    shippingQrPayload: shipping.shipping_qr_payload || "",
    shippingQrImagePath: shipping.shipping_qr_image_path || ""
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

  if (toStatus === READY_FOR_PICKUP_STATUS) {
    updateData.public_tracking_ready_for_pickup_at = moment()
      .tz("America/La_Paz")
      .format("YYYY-MM-DD HH:mm:ss");
  }

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

const markSellerWithdrawal = async (params: {
  shippingIds?: string[];
  externalSaleIds?: string[];
  withdrawnAt?: unknown;
  currentBranchId?: string;
  changedBy?: string;
}) => {
  const withdrawnAt = moment
    .tz(params.withdrawnAt as any || new Date(), "America/La_Paz")
    .format("YYYY-MM-DD HH:mm:ss");
  const shippingIds = (params.shippingIds || []).filter((id) => Types.ObjectId.isValid(id));
  const externalSaleIds = (params.externalSaleIds || []).filter((id) => Types.ObjectId.isValid(id));
  const results = {
    shippings: { updated: 0, failed: [] as { id: string; message: string }[] },
    externalSales: { updated: 0, failed: [] as { id: string; message: string }[] },
  };

  for (const shippingId of shippingIds) {
    try {
      await updateShipping(
        {
          estado_pedido: "Entregado",
          hora_entrega_real: withdrawnAt,
          retirado_por_vendedor: true,
          seller_withdrawn_at: withdrawnAt,
        },
        shippingId,
        {
          currentBranchId: params.currentBranchId,
          source: "manual",
          changedBy: params.changedBy,
          note: "Vendedor retiro el paquete",
        }
      );
      results.shippings.updated += 1;
    } catch (error: any) {
      results.shippings.failed.push({
        id: shippingId,
        message: error?.message || "No se pudo marcar el pedido",
      });
    }
  }

  for (const externalSaleId of externalSaleIds) {
    try {
      await ExternalSaleService.updateExternalSaleByID(externalSaleId, {
        estado_pedido: "Entregado",
        delivered: true,
        hora_entrega_real: withdrawnAt,
        retirado_por_vendedor: true,
        seller_withdrawn_at: withdrawnAt,
      });
      results.externalSales.updated += 1;
    } catch (error: any) {
      results.externalSales.failed.push({
        id: externalSaleId,
        message: error?.message || "No se pudo marcar la entrega externa",
      });
    }
  }

  return {
    success: results.shippings.failed.length === 0 && results.externalSales.failed.length === 0,
    updatedCount: results.shippings.updated + results.externalSales.updated,
    failedCount: results.shippings.failed.length + results.externalSales.failed.length,
    results,
  };
};

export const ShippingService = {
  getAllShippings,
  getShippingDashboardList,
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
  getShippingStatusHistory,
  markSellerWithdrawal
};
