import moment from "moment-timezone";

const TZ = "America/La_Paz";
const GRACE_DAYS = 7;
const DAILY_FEE = 1;

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
