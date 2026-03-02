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
        from: "Venta",
        let: { vendedor_id: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$vendedor", "$$vendedor_id"] }
            }
          },
          {
            $lookup: {
              from: "Pedido",
              let: { pedido_id: "$pedido" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$_id", "$$pedido_id"] }
                  }
                }
              ],
              as: "pedido"
            }
          },
          {
            $unwind: {
              path: "$pedido",
              preserveNullAndEmptyArrays: true
            }
          }
        ],
        as: "sales"
      }
    },
    {
      $lookup: {
        from: "Flujo_Financiero",
        let: { vendedor_id: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$id_vendedor", "$$vendedor_id"] },
              esDeuda: true
            }
          }
        ],
        as: "debts"
      }
    }
  ]).exec();
};

export const SellerRepository = {
  findAll,
  findAllForClientStatus: async () => {
    return await VendedorModel.find(
      {},
      {
        nombre: 1,
        apellido: 1,
        mail: 1,
        telefono: 1,
        fecha_vigencia: 1,
        pago_sucursales: 1,
      },
    )
      .lean()
      .exec();
  },
  registerSeller,
  updateSeller,
  findById,
  incrementDebt,
  findDebtsBySeller,
  markSalesAsDeposited,
  findWithDebtsAndSales,
};
