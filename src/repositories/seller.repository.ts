import mongoose from "mongoose";
import { VendedorSchema } from "../entities/implements/VendedorSchema";
import { IVendedor } from "../entities/IVendedor";
import { IVendedorDocument } from "../entities/documents/IVendedorDocument";

const VendedorModel = mongoose.model<IVendedorDocument>("Vendedor", VendedorSchema);

const findAll = async (): Promise<IVendedor[]> => {
  return await VendedorModel.find();
};

const registerSeller = async (seller: IVendedor): Promise<IVendedor> => {
  const newSeller = new VendedorModel(seller);
  return await newSeller.save();
};

const updateSeller = async (
  sellerId: string,
  updateData: Partial<IVendedor>
): Promise<IVendedor | null> => {
  return await VendedorModel.findByIdAndUpdate(sellerId, updateData, { new: true });
};

const findById = async (sellerId: string): Promise<IVendedor | null> => {
  return await VendedorModel.findById(sellerId);
};

export const SellerRepository = {
  findAll,
  registerSeller,
  updateSeller,
  findById,
};


