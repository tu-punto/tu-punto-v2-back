import AppDataSource from "../config/dataSource";
import { SucursalEntity } from "../entities/implements/SucursalEntity";
import { ISucursal } from "../entities/ISucursal";

const sucursalRepository = AppDataSource.getRepository(SucursalEntity);

const getAllSucursals = async () => {
  const sucursal = await sucursalRepository.find();
  return sucursal;
};

const getSucursalByID = async (id: number) => {
  return await sucursalRepository.findOne({ where: { id_sucursal: id } });
};

const registerSucursal = async (sucursal: ISucursal) => {
  const createdSucursal = sucursalRepository.create(sucursal);
  const newSucursal = await sucursalRepository.save(createdSucursal);
  return newSucursal;
};

const updateSucursal = async (
  sucursal: ISucursal,
  newData: Partial<ISucursal>
) => {
  const toUpdateSucursal = { ...sucursal, ...newData };
  const updatedSucursal = await sucursalRepository.save(toUpdateSucursal);
  return updatedSucursal;
};

export const SucursalRepository = {
  getAllSucursals,
  updateSucursal,
  registerSucursal,
  getSucursalByID,
};
