export const READY_FOR_PICKUP_STATUS = "LISTO PARA RECOGER";
export const IN_TRANSIT_STATUS = "En camino";

export const resolveBranchTransferInitialStatus = (
  originBranchId?: unknown,
  destinationBranchId?: unknown
) => {
  const origin = String(originBranchId ?? "").trim();
  const destination = String(destinationBranchId ?? "").trim();

  if (origin && destination && origin !== destination) {
    return IN_TRANSIT_STATUS;
  }

  return READY_FOR_PICKUP_STATUS;
};
