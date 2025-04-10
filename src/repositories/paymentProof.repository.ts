import { IComprobantePago } from "../entities/IComprobantePago";
import { IComprobantePagoDocument } from "../entities/documents/IComprobantePagoDocument";
import { ComprobantePagoModel } from "../entities/implements/ComprobantePagoSchema";

export const getPaymentProofsBySellerId = async (sellerId: number): Promise<IComprobantePagoDocument[]> => {
  const paymentProofs = await ComprobantePagoModel.find({ id_vendedor: sellerId })
    .populate('vendedor') 
    .exec();
  
  return paymentProofs;
};
