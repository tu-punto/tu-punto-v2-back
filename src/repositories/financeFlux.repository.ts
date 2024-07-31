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

export const FinanceFluxRepository = {
    findAll,
    registerFinanceFlux,
}