import { ComprobantePagoModel } from "../entities/implements/ComprobantePagoSchema";

const registerComprobante = async (comprobanteData: any) => {
  const comprobante = new ComprobantePagoModel(comprobanteData);

  await comprobante.save();
  return comprobante;
};

export const ComprobanteRepository = {
  registerComprobante,
};