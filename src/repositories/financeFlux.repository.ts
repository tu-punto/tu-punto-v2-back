import { Types } from 'mongoose';
import { FlujoFinancieroModel } from '../entities/implements/FlujoFinancieroSchema';
import { IFlujoFinanciero } from '../entities/IFlujoFinanciero';
import { IFlujoFinancieroDocument } from '../entities/documents/IFlujoFinancieroDocument';

const findAll = async (): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find().exec();
};

const registerFinanceFlux = async (financeFlux: IFlujoFinanciero): Promise<IFlujoFinancieroDocument> => {
  const newFinanceFlux = new FlujoFinancieroModel(financeFlux);
  return await newFinanceFlux.save();
};

const findWorkerById = async (workerId: Types.ObjectId): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findOne({
    trabajador: workerId
  })
    .populate('trabajador') 
    .exec();
};


const findSellerById = async (sellerId: Types.ObjectId): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findOne({
    where: {
      vendedor: sellerId
    },
    populate: ['vendedor']
  }).exec();
};

const findSellerInfoById = async (sellerId: Types.ObjectId): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find({ vendedor: sellerId }).exec();
};

export const FinanceFluxRepository = {
  findAll,
  registerFinanceFlux,
  findWorkerById,
  findSellerById,
  findSellerInfoById
};
