import { Types } from "mongoose";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { IFlujoFinancieroDocument } from "../entities/documents/IFlujoFinancieroDocument";

const financeFluxPopulate = [
  { path: "id_vendedor", select: "nombre apellido" },
  { path: "id_trabajador", select: "nombre" },
  { path: "id_sucursal", select: "nombre" },
];

const findAll = async (): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find()
    .populate(financeFluxPopulate)
    .exec();
};

const findByDateRange = async (
  from?: Date,
  to?: Date
): Promise<IFlujoFinancieroDocument[]> => {
  if (!from && !to) return await findAll();

  const match: any = {};
  match.fecha = {};
  if (from) match.fecha.$gte = from;
  if (to) match.fecha.$lte = to;

  return await FlujoFinancieroModel.find(match)
    .populate(financeFluxPopulate)
    .exec();
};

const findAllDebts = async (): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find({
    esDeuda: true,
    id_vendedor: { $ne: null },
  })
    .lean()
    .exec();
};

const registerFinanceFlux = async (
  financeFlux: IFlujoFinanciero
): Promise<IFlujoFinancieroDocument> => {
  const newFinanceFlux = new FlujoFinancieroModel(financeFlux);
  return await newFinanceFlux.save();
};

const findWorkerById = async (
  workerId: Types.ObjectId
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findOne({
    trabajador: workerId,
  })
    .populate("trabajador")
    .exec();
};

const findById = async (
  id: Types.ObjectId
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findById(id).exec();
};

const updateById = async (
  id: string,
  payload: Partial<IFlujoFinanciero>
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findByIdAndUpdate(id, payload, {
    new: true,
  }).exec();
};

const findSellerById = async (
  sellerId: Types.ObjectId
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findOne({
    where: {
      vendedor: sellerId,
    },
    populate: ["vendedor"],
  }).exec();
};

const findSellerInfoById = async (
  sellerId: Types.ObjectId
): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find({ id_vendedor: sellerId }).exec();
};

const markFinanceFluxAsPaid = async (sellerId: string): Promise<void> => {
  await FlujoFinancieroModel.updateMany(
    { id_vendedor: sellerId, esDeuda: true },
    { $set: { esDeuda: false } }
  );
};

export const FinanceFluxRepository = {
  findAll,
  findByDateRange,
  registerFinanceFlux,
  findWorkerById,
  findSellerById,
  findSellerInfoById,
  findById,
  updateById,
  markFinanceFluxAsPaid,
  findAllDebts,
};
