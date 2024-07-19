import AppDataSource from "../config/dataSource"
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasEntity"

const featureRepository = AppDataSource.getRepository(CaracteristicasEntity)

const findById = async (featureId: number): Promise<CaracteristicasEntity | null> => {
    return featureRepository.findOne({
        where: {
            id_Caracteristicas: featureId
        }
    })
}

export const FeatureRepository = {
    findById
}