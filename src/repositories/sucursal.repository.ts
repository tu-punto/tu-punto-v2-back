import AppDataSource from "../config/dataSource";
import { SucursalEntity } from "../entities/implements/SucursalEntity";


const sucursalRepository = AppDataSource.getRepository(SucursalEntity)

const getAllSucursals = async () => {
    const sucursal = await sucursalRepository.find()
    return sucursal
}

export const SucursalRepository = {
    getAllSucursals
}