import mongoose from "mongoose";
import { Types } from "mongoose";
import dayjs from "dayjs";
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

type SellerListQueryParams = {
  sellerId?: string;
  q?: string;
  status?: "activo" | "debe_renovar" | "ya_no_es_cliente" | "declinando_servicio";
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findAll = async (): Promise<IVendedor[]> => {
  return await VendedorModel.find().lean<IVendedor[]>().exec();
};

const findAllBasic = async (params?: {
  sucursalId?: string;
  sellerId?: string;
}): Promise<IVendedor[]> => {
  const filter: any = {};
  if (params?.sellerId && Types.ObjectId.isValid(params.sellerId)) {
    filter._id = new Types.ObjectId(params.sellerId);
  }
  if (params?.sucursalId && Types.ObjectId.isValid(params.sucursalId)) {
    filter["pago_sucursales.id_sucursal"] = new Types.ObjectId(params.sucursalId);
  }

  return await VendedorModel.find(filter, {
    nombre: 1,
    apellido: 1,
    marca: 1,
    telefono: 1,
    mail: 1,
    comision_porcentual: 1,
    comision_fija: 1,
    amortizacion: 1,
    precio_paquete: 1,
    fecha_vigencia: 1,
    pago_sucursales: 1,
    saldo_pendiente: 1,
    deuda: 1,
    emite_factura: 1
  })
    .lean<IVendedor[]>()
    .exec();
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
    .select("monto concepto fecha esDeuda detalle_servicios")
    .populate({ path: "detalle_servicios.id_sucursal", select: "nombre" })
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

const buildSellerListMatch = (params?: SellerListQueryParams) => {
  const match: Record<string, any> = {};

  if (params?.sellerId && Types.ObjectId.isValid(params.sellerId)) {
    match._id = new Types.ObjectId(params.sellerId);
  }

  const trimmedQuery = String(params?.q || "").trim();
  if (trimmedQuery) {
    match.$expr = {
      $regexMatch: {
        input: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$nombre", ""] },
                " ",
                { $ifNull: ["$apellido", ""] }
              ]
            }
          }
        },
        regex: escapeRegex(trimmedQuery),
        options: "i"
      }
    };
  }

  const todayStart = dayjs().startOf("day");
  if (params?.status === "declinando_servicio") {
    match.declinacion_servicio_fecha = { $exists: true, $ne: null };
    match.fecha_vigencia = { $gte: todayStart.subtract(5, "day").toDate() };
  } else if (params?.status === "activo") {
    match.fecha_vigencia = { $gte: todayStart.toDate() };
  } else if (params?.status === "debe_renovar") {
    match.fecha_vigencia = {
      $gte: todayStart.subtract(20, "day").toDate(),
      $lt: todayStart.toDate()
    };
  } else if (params?.status === "ya_no_es_cliente") {
    match.$or = [
      { fecha_vigencia: { $lt: todayStart.subtract(20, "day").toDate() } },
      {
        declinacion_servicio_fecha: { $exists: true, $ne: null },
        fecha_vigencia: { $lt: todayStart.subtract(5, "day").toDate() }
      },
      { fecha_vigencia: null },
      { fecha_vigencia: { $exists: false } }
    ];
  }

  return match;
};

const findWithDebtsAndSales = async (params?: SellerListQueryParams) => {
  const match = buildSellerListMatch(params);

  return await VendedorModel.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
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
  findAllBasic,
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
