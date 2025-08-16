import { ComprobanteRepository } from "../repositories/comprobante.repository";

const registerComprobante = async (comprobanteData: any) => {
  const comprobante =
    ComprobanteRepository.registerComprobante(comprobanteData);
  if (!comprobante) throw new Error("Failed to register comprobante");

  return comprobante;
};

export const ComprobanteService = {
  registerComprobante,
};