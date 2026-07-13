export const READY_FOR_PICKUP_STATUS = "LISTO PARA RECOGER";
export const IN_TRANSIT_STATUS = "En camino";
export const SEND_TO_BRANCH_STATUS = "PARA ENVIAR A OTRA SUCURSAL";

export const resolveBranchTransferInitialStatus = (
  originBranchId?: unknown,
  destinationBranchId?: unknown
) => {
  const origin = String(originBranchId ?? "").trim();
  const destination = String(destinationBranchId ?? "").trim();

  if (origin && destination && origin !== destination) {
    return SEND_TO_BRANCH_STATUS;
  }

  return READY_FOR_PICKUP_STATUS;
};
