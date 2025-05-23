import mongoose from "mongoose";
import { Types } from 'mongoose';
import { VendedorSchema } from "../entities/implements/VendedorSchema";
import { IVendedor } from "../entities/IVendedor";
import { IVendedorDocument } from "../entities/documents/IVendedorDocument";
import { FlujoFinancieroModel } from '../entities/implements/FlujoFinancieroSchema';

const VendedorModel = mongoose.model<IVendedorDocument>("Vendedor", VendedorSchema);

const findAll = async (): Promise<IVendedor[]> => {
  return await VendedorModel.find().lean<IVendedor[]>().exec();
};

const findById = async (sellerId: any): Promise<IVendedor | null> => {
  return await VendedorModel.findById(sellerId).lean<IVendedor>().exec();
};

const registerSeller = async (seller: IVendedor) => {
  const newSeller = new VendedorModel(seller);
  return await newSeller.save();
};

const updateSeller = async (
  sellerId: any,
  updateData: Partial<IVendedor>
) => {
  return await VendedorModel.findByIdAndUpdate(sellerId, updateData, { new: true });
};

export const incrementDebt = async (id: string, delta: number) => {
  return await VendedorModel.findByIdAndUpdate(id, { $inc: { deuda: delta } }, { new: true })
};

const findDebtsBySeller = async (sellerId: string) => {
  return await FlujoFinancieroModel.find({
    id_vendedor: new Types.ObjectId(sellerId),
  })
    .select('monto concepto fecha')
    .lean()
    .exec();
};

export const SellerRepository = {
  findAll,
  registerSeller,
  updateSeller,
  findById,
  incrementDebt,
  findDebtsBySeller
};


