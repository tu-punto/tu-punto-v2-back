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

const findByVendedores = async (sellerIds: string[]): Promise<IComprobantePagoDocument[]> => {
  const normalizedSellerIds = Array.from(
    new Set((sellerIds || []).map((sellerId) => String(sellerId || "").trim()).filter(Boolean))
  );

  if (!normalizedSellerIds.length) {
    return [];
  }

  return await ComprobantePagoModel.find({
    vendedor: { $in: normalizedSellerIds },
  })
    .populate("vendedor", "nombre apellido mail telefono")
    .exec();
};

const findByDateRange = async (params: {
  from: Date;
  to: Date;
  sellerId?: string;
}): Promise<IComprobantePagoDocument[]> => {
  const query: any = {
    fecha_emision: {
      $gte: params.from,
      $lte: params.to,
    },
  };

  if (params.sellerId) {
    query.vendedor = params.sellerId;
  }

  return await ComprobantePagoModel.find(query)
    .populate("vendedor", "nombre apellido mail telefono")
    .sort({ fecha_emision: 1, createdAt: 1, _id: 1 })
    .exec();
};

export const PaymentProofRepository = {
  findByVendedor,
  findByVendedores,
  findByDateRange,
  create,
};
