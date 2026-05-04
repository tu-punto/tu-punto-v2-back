import { CierreCajaModel } from "../entities/implements/CierreCajaSchema";
import { ICierreCaja } from "../entities/ICierreCaja";
import { Types } from "mongoose";

const findAll = async (sucursalId?: string): Promise<ICierreCaja[]> => {
  const filter: Record<string, unknown> = {};

  if (sucursalId && Types.ObjectId.isValid(sucursalId)) {
    filter.id_sucursal = new Types.ObjectId(sucursalId);
  }

  return await CierreCajaModel.find(filter)
    .populate('id_sucursal')
    .sort({ closed_at: 1, created_at: 1 })
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

const findLatestBySucursalBefore = async (
  sucursalId: string,
  before: Date
): Promise<ICierreCaja | null> => {
  if (!Types.ObjectId.isValid(sucursalId)) return null;

  return await CierreCajaModel.findOne({
    id_sucursal: new Types.ObjectId(sucursalId),
    $or: [
      { closed_at: { $lt: before } },
      { closed_at: { $exists: false }, created_at: { $lt: before } },
    ],
  })
    .sort({ closed_at: -1, created_at: -1 })
    .lean()
    .exec();
};

export const BoxCloseRepository = {
  findAll,
  registerBoxClose,
  getBoxCloseById,
  updateBoxClose,
  findLatestBySucursalBefore,
};
