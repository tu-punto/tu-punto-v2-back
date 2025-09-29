import { IComprobantePagoDocument } from "../entities/documents/IComprobantePagoDocument";
import { ComprobantePagoModel } from "../entities/implements/ComprobantePagoSchema";

const findByVendedor = async (
  sellerId: string
): Promise<IComprobantePagoDocument[]> => {
  const paymentProofs = await ComprobantePagoModel.find({
    vendedor: sellerId,
  })
    .populate("vendedor", "nombre apellido mail telefono")
    .exec();

  return paymentProofs;
};

const create = async (comprobanteData: any) => {
  const comprobante = new ComprobantePagoModel({
    ...comprobanteData,
  });

  return await comprobante.save();
};

export const PaymentProofRepository = {
  findByVendedor,
  create,
};
