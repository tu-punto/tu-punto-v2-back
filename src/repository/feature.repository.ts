import { Caracteristicas } from "../models/Caracteristicas"
import { ICaracteristicas } from '../entities/ICaracteristicas';
import AppDataSource from '../config/dataSource';
import { CaracteristicasEntity } from '../entities/implements/CaracteristicasEntity';

const featureRepository = AppDataSource.getRepository(CaracteristicasEntity);

const findAll = async (): Promise<Caracteristicas[]> => {
    return await featureRepository.find()
}

const registerFeature = async (feature: ICaracteristicas): Promise<Caracteristicas> => {
    const newfeature = featureRepository.create(feature);
    const savedFeature = await featureRepository.save(newfeature);
    return new Caracteristicas(savedFeature);
}
export const FeatureRepository = {
    findAll,
    registerFeature
}