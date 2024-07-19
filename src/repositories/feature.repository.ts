
import AppDataSource from "../config/dataSource"
import { ICaracteristicas } from "../entities/ICaracteristicas"
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasEntity"
import { Caracteristicas } from "../models/Caracteristicas"

const featureRepository = AppDataSource.getRepository(CaracteristicasEntity)

const findById = async (featureId: number): Promise<CaracteristicasEntity | null> => {
    return featureRepository.findOne({
        where: {
            id_Caracteristicas: featureId
        }
    })
}

const findAll = async (): Promise<Caracteristicas[]> => {
    return await featureRepository.find()
}

const registerFeature = async (feature: ICaracteristicas): Promise<Caracteristicas> => {
    const newfeature = featureRepository.create(feature);
    const savedFeature = await featureRepository.save(newfeature);
    return new Caracteristicas(savedFeature);
}

export const FeatureRepository = {
    findById,
    registerFeature,
    findAll
}