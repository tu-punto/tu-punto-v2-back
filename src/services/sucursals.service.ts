import { SucursalRepository } from "../repositories/sucursal.repository"



const getAllSucursals = async () => {
    const sucursal =  await SucursalRepository.getAllSucursals()
    return sucursal
}

export const SucursalsService = {
    getAllSucursals
}