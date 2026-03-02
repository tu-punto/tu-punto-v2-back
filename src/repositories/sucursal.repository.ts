import { SucursalModel } from "../entities/implements/SucursalSchema";
import { ISucursal } from "../entities/ISucursal";

const getAllSucursals = async () => {
  const sucursales = await SucursalModel.find().populate([
    'pedido',
    'trabajador',
    'ingreso',
    'cierre_caja'
  ]);
  return sucursales;
};

const getSucursalByID = async (id: string) => {
  return await SucursalModel.findById(id).populate([
    'pedido',
    'trabajador',
    'ingreso',
    'cierre_caja'
  ]);
};

const getSucursalHeaderInfoByID = async (id: string) => {
  return await SucursalModel.findById(id).select("_id nombre imagen_header").lean();
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
    { _id: sucursal._id},
    newData,
    { new: true }
  );
  return updated;
};

const updateSucursalByID = async (
  id: string,
  newData: Partial<ISucursal>
) => {
  return await SucursalModel.findByIdAndUpdate(id, newData, { new: true });
};


export const SucursalRepository = {
  getAllSucursals,
  updateSucursal,
  updateSucursalByID,
  registerSucursal,
  getSucursalHeaderInfoByID,
  getSucursalByID,
};
