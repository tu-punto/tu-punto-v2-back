import { SucursalModel } from "../entities/implements/SucursalSchema";
import { ISucursal } from "../entities/ISucursal";

const getAllSucursals = async () => {
  const sucursales = await SucursalModel.find().populate([
    'producto_sucursal',
    'pedido',
    'trabajador',
    'ingreso',
    'cierre_caja'
  ]);
  return sucursales;
};

const getSucursalByID = async (id: number) => {
  return await SucursalModel.findOne({ id_sucursal: id }).populate([
    'producto_sucursal',
    'pedido',
    'trabajador',
    'ingreso',
    'cierre_caja'
  ]);
};

const registerSucursal = async (sucursal: ISucursal) => {
  const newSucursal = new SucursalModel(sucursal);
  return await newSucursal.save();
};

const updateSucursal = async (
  sucursal: any,
  newData: Partial<ISucursal>
) => {
  const updated = await SucursalModel.findOneAndUpdate(
    { id_sucursal: sucursal.id_sucursal },
    { ...sucursal, ...newData },
    { new: true }
  );
  return updated;
};


export const SucursalRepository = {
  getAllSucursals,
  updateSucursal,
  registerSucursal,
  getSucursalByID,
};
