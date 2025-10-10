import { Types } from "mongoose";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { IFlujoFinancieroDocument } from "../entities/documents/IFlujoFinancieroDocument";

const findAll = async (): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find()
    .populate("id_vendedor", "nombre apellido") // <-- solo estos campos
    .populate("id_trabajador", "nombre") // <-- solo este campo
    .populate("id_sucursal", "nombre")
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

const findAllWithFilter = async (filter: any = {}): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find(filter)
    .populate("id_vendedor", "nombre apellido")
    .populate("id_trabajador", "nombre")
    .populate("id_sucursal", "nombre")
    .exec();
};

export const FinanceFluxRepository = {
  findAll,
  registerFinanceFlux,
  findWorkerById,
  findSellerById,
  findSellerInfoById,
  findById,
  updateById,
  markFinanceFluxAsPaid,
  findAllDebts,
  findAllWithFilter,
};
