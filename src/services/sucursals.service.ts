import { ISucursal } from "../entities/ISucursal";
import { SucursalRepository } from "../repositories/sucursal.repository";
import sucursalRouter from "../routes/sucursal.routes";

const getAllSucursals = async () => {
  const sucursal = await SucursalRepository.getAllSucursals();
  return sucursal;
};

const registerSucursal = async (sucursal: ISucursal) => {
  return SucursalRepository.registerSucursal(sucursal);
};

const getSucursalByID = async (id: number) => {
  const sucursal = await SucursalRepository.getSucursalByID(id);
  if (!sucursal) throw new Error("Doesn't exist a sucursal with such id");
  return sucursal;
};

const updateSucursal = async (sucursalID: number, newData: any) => {
  const sucursal = await SucursalRepository.getSucursalByID(sucursalID);
  if (!sucursal)
    throw new Error(`sucursal with id ${sucursalID} doesn't exist`);
  return await SucursalRepository.updateSucursal(sucursal, newData);
};

export const SucursalsService = {
  getAllSucursals,
  registerSucursal,
  updateSucursal,
  getSucursalByID,
};
