import { IFlujoFinanciero } from "../entities/IFlujoFinanciero"
import { FinanceFluxRepository } from "../repositories/financeFlux.repository"

const getAllFinanceFluxes = async () => {
    const financeFluxes = await FinanceFluxRepository.findAll()
    return financeFluxes
}

const registerFinanceFlux = async (financeFlux: IFlujoFinanciero) => {
    const newFinanceFlux = await FinanceFluxRepository.registerFinanceFlux(financeFlux)
    return newFinanceFlux
}

export const FinanceFluxService = {
    getAllFinanceFluxes,
    registerFinanceFlux,
}