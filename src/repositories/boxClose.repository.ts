import { CierreCajaModel } from "../entities/implements/CierreCajaSchema";
import { ICierreCaja } from "../entities/ICierreCaja";

const findAll = async (): Promise<ICierreCaja[]> => {
  return await CierreCajaModel.find()
    .populate('id_efectivo_diario')
    .populate('id_sucursal')
    .lean() 
    .exec();
};
const registerBoxClose = async (boxClose: ICierreCaja): Promise<ICierreCaja> => {
  const newBoxClose = new CierreCajaModel(boxClose);
  return await newBoxClose.save();
};

const getBoxCloseById = async (id: string): Promise<ICierreCaja | null> => {
  return await CierreCajaModel.findById(id)
    .populate('id_efectivo_diario')
    .populate('id_sucursal')
    .lean() 
    .exec();
};

export const BoxCloseRepository = {
  findAll,
  registerBoxClose,
  getBoxCloseById,
};
