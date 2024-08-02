import AppDataSource from "../config/dataSource"
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero"
import { FlujoFinancieroEntity } from "../entities/implements/FlujoFinancieroEntity"
import { FlujoFinanciero } from "../models/FlujoFinanciero"

const financeFluxRepository = AppDataSource.getRepository(FlujoFinancieroEntity)

const findAll = async () => {
    return await financeFluxRepository.find()
}

const registerFinanceFlux = async (financeFlux: IFlujoFinanciero) => {
    const newFinanceFlux = financeFluxRepository.create(financeFlux)
    const savedFinanceFlux: IFlujoFinanciero = await financeFluxRepository.save(newFinanceFlux)
    return new FlujoFinanciero(savedFinanceFlux)
}
const findWorkerById = async (workerId: number): Promise<FlujoFinancieroEntity | null> => {
    return await financeFluxRepository.findOne({
        where: {
            trabajador: {
                id_trabajador: workerId
            }
        },
        relations: ['trabajador']
    })
}
const findSellerById = async (sellerId: number): Promise<FlujoFinancieroEntity | null> => {
    return await financeFluxRepository.findOne({
        where: {
            vendedor: {
                id_vendedor: sellerId
            }
        },
        relations: ['vendedor']
    })
}
export const FinanceFluxRepository = {
    findAll,
    registerFinanceFlux,
    findWorkerById,
    findSellerById
}