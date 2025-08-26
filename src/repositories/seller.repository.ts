import mongoose from "mongoose";
import { Types } from "mongoose";
import { VendedorSchema } from "../entities/implements/VendedorSchema";
import { IVendedor } from "../entities/IVendedor";
import { IVendedorDocument } from "../entities/documents/IVendedorDocument";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { PedidoModel } from "../entities/implements/PedidoSchema";

const VendedorModel = mongoose.model<IVendedorDocument>(
  "Vendedor",
  VendedorSchema
);

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

const updateSeller = async (sellerId: any, updateData: Partial<IVendedor>) => {
  return await VendedorModel.findByIdAndUpdate(sellerId, updateData, {
    new: true,
  });
};

export const incrementDebt = async (id: string, delta: number) => {
  return await VendedorModel.findByIdAndUpdate(
    id,
    { $inc: { deuda: delta } },
    { new: true }
  );
};

const findDebtsBySeller = async (sellerId: string) => {
  return await FlujoFinancieroModel.find({
    id_vendedor: new Types.ObjectId(sellerId),
    esDeuda: true,
  })
    .select("monto concepto fecha esDeuda")
    .lean()
    .exec();
};

const markSalesAsDeposited = async (sellerId: string): Promise<void> => {
  const validSales = await VentaModel.aggregate([
    {
      $match: {
        deposito_realizado: false,
        vendedor: new Types.ObjectId(sellerId),
      },
    },
    {
      $lookup: {
        from: "Pedido",
        localField: "pedido",
        foreignField: "_id",
        as: "pedidoInfo",
        pipeline: [
          {
            $project: {
              estado_pedido: 1,
            },
          },
        ],
      },
    },
    {
      $match: {
        "pedidoInfo.estado_pedido": { $ne: "En Espera" },
      },
    },
    {
      $project: {
        _id: 1,
      },
    },
  ]);
  if (validSales.length === 0) {
    console.log("No valid sales found for the seller.");
    return;
  }
  await VentaModel.updateMany(
    {
      _id: { $in: validSales },
      vendedor: sellerId,
      deposito_realizado: false,
    },
    { $set: { deposito_realizado: true } }
  );
};

const findWithDebtsAndSales = async () => {
  return await VendedorModel.aggregate([
    {
      $lookup: {
        from: "ventas", 
        localField: "_id",
        foreignField: "vendedor",
        as: "sales",
      },
    },
    {
      $lookup: {
        from: "flujofinancieros", 
        localField: "_id",
        foreignField: "id_vendedor",
        as: "debts",
      },
    },
    {
      $addFields: {
        debts: {
          $filter: {
            input: "$debts",
            as: "debt",
            cond: { $eq: ["$$debt.esDeuda", true] },
          },
        },
      },
    },
  ]).exec();
};

export const SellerRepository = {
  findAll,
  registerSeller,
  updateSeller,
  findById,
  incrementDebt,
  findDebtsBySeller,
  markSalesAsDeposited,
  findWithDebtsAndSales,
};
