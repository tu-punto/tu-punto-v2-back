import moment from "moment-timezone";

const TZ = "America/La_Paz";
const GRACE_DAYS = 7;
const DAILY_FEE = 1;

export const calculateEstimatedBranchPickupDate = (value?: unknown) => {
  const createdAt = value ? moment.tz(value as any, TZ) : moment.tz(TZ);
  if (!createdAt.isValid()) return null;

  const day = createdAt.isoWeekday();
  const daysToAdd = day === 2 ? 2 : day === 3 ? 1 : day === 4 ? 5 : day === 5 ? 4 : day === 6 ? 3 : day === 7 ? 2 : 1;
  return createdAt.add(daysToAdd, "days");
};

export const getEstimatedBranchPickupDateLabel = (value?: unknown) =>
  calculateEstimatedBranchPickupDate(value)?.format("DD/MM/YYYY") || "";

export const resolveBranchPickupFeeStart = (order: {
  fecha_pedido?: unknown;
  public_tracking_schedule_base_at?: unknown;
}) => {
  const scheduleBaseAt = order.public_tracking_schedule_base_at || order.fecha_pedido;
  return calculateEstimatedBranchPickupDate(scheduleBaseAt) || scheduleBaseAt || order.fecha_pedido;
};

export const calculateLatePickupFee = (params: {
  startAt?: unknown;
  pickedUpAt?: unknown;
}) => {
  if (!params.startAt || !params.pickedUpAt) return 0;

  const start = moment.tz(params.startAt as any, TZ);
  const pickedUp = moment.tz(params.pickedUpAt as any, TZ);
  if (!start.isValid() || !pickedUp.isValid()) return 0;

  const elapsedDays = pickedUp.startOf("day").diff(start.startOf("day"), "days");
  return Math.max(0, elapsedDays - GRACE_DAYS) * DAILY_FEE;
};

export const addLatePickupFeeToPayment = (params: {
  fee: number;
  paymentType?: unknown;
  subtotalQr?: unknown;
  subtotalEfectivo?: unknown;
}) => {
  const fee = Math.max(0, Number(params.fee || 0));
  const subtotalQr = Number(params.subtotalQr || 0);
  const subtotalEfectivo = Number(params.subtotalEfectivo || 0);
  const paymentType = String(params.paymentType || "").trim().toLowerCase();

  if (fee <= 0) {
    return { subtotalQr, subtotalEfectivo };
  }

  if (paymentType === "1" || paymentType === "transferencia o qr" || paymentType === "qr") {
    return { subtotalQr: subtotalQr + fee, subtotalEfectivo };
  }

  return { subtotalQr, subtotalEfectivo: subtotalEfectivo + fee };
};
