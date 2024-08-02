import { SellerRepository } from './../repositories/seller.repository';
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero"
import { FinanceFluxRepository } from "../repositories/financeFlux.repository"
import { WorkerRepository } from "../repositories/worker.repository"

const getAllFinanceFluxes = async () => {
    const financeFluxes = await FinanceFluxRepository.findAll()
    return financeFluxes
}

const registerFinanceFlux = async (financeFlux: IFlujoFinanciero) => {
    const newFinanceFlux = await FinanceFluxRepository.registerFinanceFlux(financeFlux)
    return newFinanceFlux
}
const getWorkerById = async (workerId: number) => {
    const financeFlux = await FinanceFluxRepository.findWorkerById(workerId)
    if(!financeFlux)
        throw new Error("Doesn't exist such worker with that id fk from FinanceFlux")
    const worker = await WorkerRepository.getWorkerByFinanceFlux(financeFlux.trabajador.id_trabajador)

    if (!worker) {
        throw new Error("No worker found with the given id");
    }

    return {
        id_trabajador: worker.id_trabajador,
        nombre: worker.nombre
    };
}
const getSellerById = async (sellerId: number) => {
    const financeFlux = await FinanceFluxRepository.findSellerById(sellerId)
    if(!financeFlux)
        throw new Error("Doesn't exist such seller with that id fk from FinanceFlux")
    const seller = await SellerRepository.getSellerByFinanceFlux(financeFlux.vendedor.id_vendedor)

    if (!seller) {
        throw new Error("No seller found with the given id");
    }

    return {
        id_vendedor: seller.id_vendedor,
        nombre: seller.nombre,
        apellido: seller.apellido,
        marca: seller.marca
    };
}

export const FinanceFluxService = {
    getAllFinanceFluxes,
    registerFinanceFlux,
    getWorkerById,
    getSellerById
}