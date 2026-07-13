import moment from "moment-timezone";
import { SEND_TO_BRANCH_STATUS } from "../utils/branchTransferStatus";

const TZ = "America/La_Paz";

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
  lugar_origen?: BranchLike;
  origen_sucursal?: BranchLike;
  destino_sucursal?: BranchLike;
  sucursal?: BranchLike;
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

const getScheduleBaseDate = (order: TrackingOrderLike, fallback: Date): Date => {
  return toDateOrNull(order.public_tracking_schedule_base_at) || fallback;
};

const isDelivered = (order: TrackingOrderLike) =>
  toTrimmed(order.estado_pedido).toLowerCase() === "entregado" && !order.public_tracking_ready_for_pickup_at;

const isPendingBranchSend = (order: TrackingOrderLike) =>
  toTrimmed(order.estado_pedido) === SEND_TO_BRANCH_STATUS;

const isFrozen = (order: TrackingOrderLike) => order.public_tracking_frozen === true;

const normalizeFrozenStatus = (value: unknown): PublicTrackingStatus | null => {
  const normalized = toTrimmed(value).toUpperCase();
  if (
    normalized === "RECEPTION" ||
    normalized === "IN_TRANSIT" ||
    normalized === "READY_FOR_PICKUP" ||
    normalized === "DELIVERED"
  ) {
    return normalized as PublicTrackingStatus;
  }
  return null;
};

const isDeliveryOrder = (order: TrackingOrderLike): boolean => {
  const originId =
    resolveBranchId(order.lugar_origen) ||
    resolveBranchId(order.origen_sucursal) ||
    resolveBranchId(order.sucursal);
  const destinationId =
    resolveBranchId(order.destino_sucursal) ||
    resolveBranchId(order.sucursal) ||
    resolveBranchId(order.lugar_origen) ||
    resolveBranchId(order.origen_sucursal);

  if (!originId || !destinationId) return false;
  return originId !== destinationId;
};

const nextTransferDayBase = (receivedAt: Date) => {
  const base = moment.tz(receivedAt, TZ);
  if (!base.isValid()) return moment.tz(TZ);

  for (let daysToAdd = 0; daysToAdd <= 7; daysToAdd += 1) {
    const candidate = base.clone().add(daysToAdd, "days");
    const weekday = candidate.isoWeekday();
    if (weekday !== 2 && weekday !== 4) continue;

    const noon = candidate.clone().hour(12).minute(0).second(0).millisecond(0);
    if (noon.isSameOrAfter(base)) return candidate;
  }

  return base.clone().add(1, "week").isoWeekday(2);
};

const getTransferTimes = (receivedAt: Date) => {
  const transferDay = nextTransferDayBase(receivedAt);
  return {
    inTransitAt: transferDay.clone().hour(12).minute(0).second(0).millisecond(0).toDate(),
    readyAt: transferDay.clone().hour(15).minute(0).second(0).millisecond(0).toDate(),
  };
};

const pickCurrentStatus = (params: {
  delivered: boolean;
  delivery: boolean;
  now: Date;
  inTransitAt?: Date;
  readyAt: Date;
}): PublicTrackingStatus => {
  if (params.delivered) return "DELIVERED";
  if (!params.delivery) return "READY_FOR_PICKUP";
  if (params.now >= params.readyAt) return "READY_FOR_PICKUP";
  if (params.inTransitAt && params.now >= params.inTransitAt) return "IN_TRANSIT";
  return "RECEPTION";
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
  const scheduleBaseAt = getScheduleBaseDate(order, receptionAt);
  const delivery = isDeliveryOrder(order);
  const delivered = isDelivered(order);
  const readyForPickupAt = toDateOrNull(order.public_tracking_ready_for_pickup_at);
  const deliveredAt = delivered ? toDateOrNull(order.hora_entrega_real) || now : null;
  const pendingBranchSend = isPendingBranchSend(order);
  const transferTimes = delivery
    ? getTransferTimes(scheduleBaseAt)
    : { inTransitAt: undefined, readyAt: receptionAt };
  const status =
    readyForPickupAt
      ? "READY_FOR_PICKUP"
      : pendingBranchSend
      ? "RECEPTION"
      : isFrozen(order) && delivery && !delivered
      ? normalizeFrozenStatus(order.public_tracking_frozen_status) || "RECEPTION"
      : pickCurrentStatus({
          delivered,
          delivery,
          now,
          inTransitAt: transferTimes.inTransitAt,
          readyAt: transferTimes.readyAt,
        });

  return {
    status,
    statusLabel: TRACKING_LABELS[status],
    hasDelivery: delivery,
    receptionAt,
    inTransitAt: transferTimes.inTransitAt || null,
    readyForPickupAt: readyForPickupAt || transferTimes.readyAt,
    deliveredAt,
    steps: buildSteps({
      status,
      delivery,
      receptionAt,
      inTransitAt: transferTimes.inTransitAt,
      readyAt: transferTimes.readyAt,
      deliveredAt,
    }),
  };
};

export const TrackingTimelineService = {
  buildPublicTracking,
};
