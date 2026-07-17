import moment from "moment-timezone";
import { IN_TRANSIT_STATUS, READY_FOR_PICKUP_STATUS, SEND_TO_BRANCH_STATUS } from "../utils/branchTransferStatus";

const TZ = "America/La_Paz";
const WAITING_RAW_STATUS = "En Espera";
const INTERNAL_SALE_STATUS = "interno";
const VISUAL_IN_TRANSIT_THRESHOLD_MINUTES = 30;

export type PublicTrackingStatus =
  | "RECEPTION"
  | "IN_TRANSIT"
  | "READY_FOR_PICKUP"
  | "DELIVERED";

export type PublicTrackingStep = {
  key: PublicTrackingStatus;
  label: string;
  at: Date | null;
  completed: boolean;
  current: boolean;
};

type BranchLike = unknown;

type TrackingOrderLike = {
  estado_pedido?: unknown;
  fecha_pedido?: unknown;
  public_tracking_received_at?: unknown;
  public_tracking_schedule_base_at?: unknown;
  public_tracking_ready_for_pickup_at?: unknown;
  public_tracking_frozen?: unknown;
  public_tracking_frozen_status?: unknown;
  hora_entrega_real?: unknown;
  hora_entrega_acordada?: unknown;
  lugar_origen?: BranchLike;
  origen_sucursal?: BranchLike;
  destino_sucursal?: BranchLike;
  sucursal?: BranchLike;
  simple_package_order?: unknown;
  simple_package_source_id?: unknown;
  service_origin?: unknown;
};

const TRACKING_LABELS: Record<PublicTrackingStatus, string> = {
  RECEPTION: "Recepcion",
  IN_TRANSIT: "En camino",
  READY_FOR_PICKUP: "Listo para recoger",
  DELIVERED: "Entregado",
};

const toTrimmed = (value: unknown) => String(value ?? "").trim();

const resolveBranchId = (value: BranchLike): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const maybeObject = value as Record<string, unknown>;
    return toTrimmed(maybeObject._id ?? maybeObject.id ?? maybeObject.$oid);
  }
  return "";
};

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getReceptionDate = (order: TrackingOrderLike): Date => {
  return (
    toDateOrNull(order.public_tracking_received_at) ||
    toDateOrNull(order.fecha_pedido) ||
    new Date()
  );
};

const isDelivered = (order: TrackingOrderLike) =>
  toTrimmed(order.estado_pedido).toLowerCase() === "entregado";

const isPendingBranchSend = (order: TrackingOrderLike) =>
  toTrimmed(order.estado_pedido) === SEND_TO_BRANCH_STATUS;

const isDeliveryOrder = (order: TrackingOrderLike): boolean => {
  return isBranchTransferManagedOrder(order) || isRegularScheduledOrder(order);
};

const getRawStatus = (order: TrackingOrderLike) => toTrimmed(order.estado_pedido);

const isInternalSaleOrder = (order: TrackingOrderLike) =>
  getRawStatus(order).toLowerCase() === INTERNAL_SALE_STATUS;

const isSimplePackageOrder = (order: TrackingOrderLike) =>
  order.simple_package_order === true || Boolean(order.simple_package_source_id);

const isExternalOrder = (order: TrackingOrderLike) => {
  const origin = toTrimmed(order.service_origin).toLowerCase();
  return origin === "external" || origin === "simple_package";
};

const isRegularScheduledOrder = (order: TrackingOrderLike) =>
  !isInternalSaleOrder(order) && !isSimplePackageOrder(order) && !isExternalOrder(order);

const isBranchTransferManagedOrder = (order: TrackingOrderLike) => {
  if (!isSimplePackageOrder(order) && !isExternalOrder(order)) {
    return false;
  }

  const originId =
    resolveBranchId(order.lugar_origen) ||
    resolveBranchId(order.origen_sucursal) ||
    resolveBranchId(order.sucursal);
  const destinationId =
    resolveBranchId(order.destino_sucursal) ||
    resolveBranchId(order.sucursal);

  return Boolean(originId && destinationId && originId !== destinationId);
};

const getScheduledDate = (order: TrackingOrderLike, fallback: Date) =>
  toDateOrNull(order.hora_entrega_acordada) ||
  toDateOrNull(order.public_tracking_schedule_base_at) ||
  fallback;

const getRegularInTransitAt = (order: TrackingOrderLike, fallback: Date) => {
  if (!isRegularScheduledOrder(order)) return null;

  const scheduledAt = getScheduledDate(order, fallback);
  return moment
    .tz(scheduledAt, TZ)
    .subtract(VISUAL_IN_TRANSIT_THRESHOLD_MINUTES, "minutes")
    .toDate();
};

const shouldDisplayRegularInTransit = (order: TrackingOrderLike, now: Date, receptionAt: Date) => {
  if (getRawStatus(order) !== WAITING_RAW_STATUS) return false;

  const inTransitAt = getRegularInTransitAt(order, receptionAt);
  return Boolean(inTransitAt && now >= inTransitAt);
};

const buildSteps = (params: {
  status: PublicTrackingStatus;
  delivery: boolean;
  receptionAt: Date;
  inTransitAt?: Date;
  readyAt: Date;
  deliveredAt: Date | null;
}): PublicTrackingStep[] => {
  const statuses: PublicTrackingStatus[] = params.delivery
    ? ["RECEPTION", "IN_TRANSIT", "READY_FOR_PICKUP", "DELIVERED"]
    : ["RECEPTION", "READY_FOR_PICKUP", "DELIVERED"];
  const currentIndex = statuses.indexOf(params.status);

  return statuses.map((key, index) => {
    const at =
      key === "RECEPTION"
        ? params.receptionAt
        : key === "IN_TRANSIT"
          ? params.inTransitAt || null
          : key === "READY_FOR_PICKUP"
            ? params.readyAt
            : params.deliveredAt;

    return {
      key,
      label: TRACKING_LABELS[key],
      at,
      completed: index < currentIndex || key === params.status,
      current: key === params.status,
    };
  });
};

const buildPublicTracking = (order: TrackingOrderLike, now = new Date()) => {
  const receptionAt = getReceptionDate(order);
  const scheduleBaseAt = getScheduledDate(order, receptionAt);
  const delivery = isDeliveryOrder(order);
  const delivered = isDelivered(order);
  const readyForPickupAt = toDateOrNull(order.public_tracking_ready_for_pickup_at);
  const deliveredAt = delivered ? toDateOrNull(order.hora_entrega_real) || now : null;
  const pendingBranchSend = isPendingBranchSend(order);
  const rawStatus = getRawStatus(order);
  const visualInTransit = shouldDisplayRegularInTransit(order, now, receptionAt);
  const inTransitAt =
    rawStatus === IN_TRANSIT_STATUS || visualInTransit
      ? getRegularInTransitAt(order, receptionAt) ||
        toDateOrNull(order.public_tracking_schedule_base_at) ||
        receptionAt
      : delivery
      ? toDateOrNull(order.public_tracking_schedule_base_at) || receptionAt
      : null;
  const readyAt = readyForPickupAt || scheduleBaseAt;
  const status =
    delivered
      ? "DELIVERED"
      : readyForPickupAt || rawStatus === READY_FOR_PICKUP_STATUS
      ? "READY_FOR_PICKUP"
      : rawStatus === IN_TRANSIT_STATUS || visualInTransit
      ? "IN_TRANSIT"
      : pendingBranchSend
      ? "RECEPTION"
      : rawStatus === WAITING_RAW_STATUS || !rawStatus
      ? "RECEPTION"
      : "RECEPTION";

  return {
    status,
    statusLabel: TRACKING_LABELS[status],
    hasDelivery: delivery,
    receptionAt,
    inTransitAt,
    readyForPickupAt: readyAt,
    deliveredAt,
    steps: buildSteps({
      status,
      delivery,
      receptionAt,
      inTransitAt: inTransitAt || undefined,
      readyAt,
      deliveredAt,
    }),
  };
};

export const TrackingTimelineService = {
  buildPublicTracking,
};
