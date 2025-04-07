
import AppDataSource from "../config/dataSource"
import { ICaracteristicas } from "../entities/ICaracteristicas"
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasSchema"
import { IProducto } from "../entities/IProducto"
import { Caracteristicas } from "../models/Caracteristicas"

const featureRepository = AppDataSource.getRepository(CaracteristicasEntity)

const findById = async (featureId: number): Promise<CaracteristicasEntity | null> => {
    return featureRepository.findOne({
        where: {
            id_caracteristicas: featureId
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

const getFeaturesByProductId = async (productId: IProducto) => {
    return await featureRepository.find({
        where: {product: productId}
    })
}

export const FeatureRepository = {
    findById,
    registerFeature,
    findAll,
    getFeaturesByProductId
}