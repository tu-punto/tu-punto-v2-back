import { CierreCajaModel } from "../entities/implements/CierreCajaSchema";
import { ICierreCaja } from "../entities/ICierreCaja";

const findAll = async (): Promise<ICierreCaja[]> => {
  return await CierreCajaModel.find()
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
    .populate('id_sucursal')
    .lean() 
    .exec();
};
const updateBoxClose = async (id: string, updates: Partial<ICierreCaja>) => {
  return await CierreCajaModel.findByIdAndUpdate(id, updates, { new: true });
};


export const BoxCloseRepository = {
  findAll,
  registerBoxClose,
  getBoxCloseById,
  updateBoxClose,
};
