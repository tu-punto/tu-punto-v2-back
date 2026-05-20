const CAPPED_SELLER_ID = "6890ed599a4e9d7133691bcb";
const CAPPED_SELLER_MAX_COMMISSION = 25;

const normalizeId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String((value as any)?._id ?? (value as any)?.$oid ?? value);
};

export const applySellerCommissionCap = (sellerId: unknown, commission: number): number => {
  const safeCommission = Number.isFinite(commission) ? commission : 0;

  if (normalizeId(sellerId) !== CAPPED_SELLER_ID) {
    return safeCommission;
  }

  return Math.min(safeCommission, CAPPED_SELLER_MAX_COMMISSION);
};
