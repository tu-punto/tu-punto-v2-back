
import { Types } from 'mongoose';
import { CaracteristicasModel } from '../entities/implements/CaracteristicasSchema';
import { ICaracteristicas } from '../entities/ICaracteristicas';
import { ICaracteristicasDocument } from '../entities/documents/ICaracteristicasDocument';
import { FinanceFluxModel } from "../entities/implements/FinanceFluxSchema ";
import { IFinanceFluxDocument } from "../entities/documents/IFinanceFluxDocument";

const findById = async (featureId: Types.ObjectId): Promise<ICaracteristicasDocument | null> => {
  return await CaracteristicasModel.findById(featureId).exec();
};

const findAll = async (): Promise<ICaracteristicasDocument[]> => {
  return await CaracteristicasModel.find().exec();
};

const findAllDashboard = async (): Promise<IFinanceFluxDocument[]> => {
  return await FinanceFluxModel.find().exec();
};

const registerFeature = async (feature: ICaracteristicas): Promise<ICaracteristicasDocument> => {
  const newFeature = new CaracteristicasModel(feature);
  return await newFeature.save();
};

const getFeaturesByProductId = async (productId: any): Promise<ICaracteristicasDocument[]> => {
  return await CaracteristicasModel.find({ product: productId }).exec();
};

export const FeatureRepository = {
  findById,
  findAll,
  registerFeature,
  getFeaturesByProductId,
  findAllDashboard
};