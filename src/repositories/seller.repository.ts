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
  pendingPayment?: "con_deuda" | "sin_deuda";
  assignedPaymentDay?: "sin_solicitud" | "8" | "18" | "28";
  sortBy?:
    | "nombre"
    | "estado"
    | "pago_pendiente"
    | "fecha_vigencia"
    | "fecha_pago_asignada"
    | "pago_mensual"
    | "comision_porcentual"
    | "emite_factura";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
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
    .select("monto concepto fecha esDeuda clase_cobro visible_en_flujo_general detalle_servicios")
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
    const tokens = trimmedQuery.split(/\s+/).filter(Boolean).slice(0, 4);
    const searchableFields = ["nombre", "apellido", "marca", "mail"];

    match.$and = tokens.map((token) => ({
      $or: searchableFields.map((field) => ({
        [field]: { $regex: escapeRegex(token), $options: "i" },
      })),
    }));
  }

  const todayStart = dayjs().startOf("day");
  if (params?.status === "declinando_servicio") {
    match.declinacion_servicio_fecha = { $exists: true, $ne: null };
    match.fecha_vigencia = { $gte: todayStart.subtract(5, "day").toDate() };
  } else if (params?.status === "activo") {
    match.fecha_vigencia = { $gte: todayStart.toDate() };
    match.$or = [
      { declinacion_servicio_fecha: { $exists: false } },
      { declinacion_servicio_fecha: null }
    ];
  } else if (params?.status === "debe_renovar") {
    match.fecha_vigencia = {
      $gte: todayStart.subtract(20, "day").toDate(),
      $lt: todayStart.toDate()
    };
    match.$or = [
      { declinacion_servicio_fecha: { $exists: false } },
      { declinacion_servicio_fecha: null }
    ];
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

  if (params?.assignedPaymentDay === "sin_solicitud") {
    match.$and = [
      ...(Array.isArray(match.$and) ? match.$and : []),
      {
        $or: [
          { fecha_pago_asignada: { $exists: false } },
          { fecha_pago_asignada: null },
          { fecha_pago_asignada: "" },
        ],
      },
    ];
  } else if (params?.assignedPaymentDay) {
    match.$and = [
      ...(Array.isArray(match.$and) ? match.$and : []),
      {
        $expr: {
          $eq: [{ $dayOfMonth: "$fecha_pago_asignada" }, Number(params.assignedPaymentDay)],
        },
      },
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
    },
    {
      $lookup: {
        from: "VentaExterna",
        let: { vendedor_id: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$id_vendedor", "$$vendedor_id"] },
              service_origin: "simple_package",
              is_external: true,
              deposito_realizado: { $ne: true },
              $or: [{ delivered: true }, { estado_pedido: "Entregado" }, { estado_pedido: "interno" }],
            }
          },
          {
            $project: {
              saldo_por_paquete: { $ifNull: ["$saldo_por_paquete", 0] },
              estado_pedido: 1,
              deposito_realizado: 1,
            }
          }
        ],
        as: "simplePackageSales"
      }
    }
  ]).exec();
};

const buildSellerMetricsStages = () => [
  {
    $lookup: {
      from: "Venta",
      let: { vendedor_id: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$vendedor", "$$vendedor_id"] },
            deposito_realizado: { $ne: true },
          },
        },
        {
          $lookup: {
            from: "Pedido",
            localField: "pedido",
            foreignField: "_id",
            as: "pedido",
          },
        },
        { $unwind: "$pedido" },
        {
          $match: {
            "pedido.estado_pedido": { $in: ["Entregado", "interno"] },
          }
        },
        {
          $project: {
            pedidoId: "$pedido._id",
            saleBalance: {
              $cond: [
                "$pedido.pagado_al_vendedor",
                { $multiply: [{ $ifNull: ["$utilidad", 0] }, -1] },
                {
                  $subtract: [
                    {
                      $multiply: [
                        { $ifNull: ["$cantidad", 0] },
                        { $ifNull: ["$precio_unitario", 0] },
                      ],
                    },
                    { $ifNull: ["$utilidad", 0] },
                  ],
                },
              ],
            },
            orderDiscount: {
              $add: [
                { $ifNull: ["$pedido.adelanto_cliente", 0] },
                { $ifNull: ["$pedido.cargo_delivery", 0] },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$pedidoId",
            saleBalance: { $sum: "$saleBalance" },
            orderDiscount: { $first: "$orderDiscount" },
          },
        },
        {
          $group: {
            _id: null,
            saldo_pendiente: {
              $sum: { $subtract: ["$saleBalance", "$orderDiscount"] },
            },
          },
        },
      ],
      as: "salesMetrics",
    },
  },
  {
    $lookup: {
      from: "VentaExterna",
      let: { vendedor_id: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$id_vendedor", "$$vendedor_id"] },
            service_origin: "simple_package",
            is_external: true,
            deposito_realizado: { $ne: true },
            $or: [{ delivered: true }, { estado_pedido: "Entregado" }, { estado_pedido: "interno" }],
          },
        },
        {
          $group: {
            _id: null,
            saldo_pendiente: { $sum: { $ifNull: ["$saldo_por_paquete", 0] } },
          },
        },
      ],
      as: "simplePackageMetrics",
    },
  },
  {
    $lookup: {
      from: "Flujo_Financiero",
      let: { vendedor_id: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$id_vendedor", "$$vendedor_id"] },
            esDeuda: true,
          },
        },
        {
          $group: {
            _id: null,
            deuda: { $sum: { $ifNull: ["$monto", 0] } },
          },
        },
      ],
      as: "debtMetrics",
    },
  },
  {
    $addFields: {
      saldo_pendiente: {
        $add: [
          { $ifNull: [{ $arrayElemAt: ["$salesMetrics.saldo_pendiente", 0] }, 0] },
          { $ifNull: [{ $arrayElemAt: ["$simplePackageMetrics.saldo_pendiente", 0] }, 0] },
        ],
      },
      deuda: {
        $ifNull: [{ $arrayElemAt: ["$debtMetrics.deuda", 0] }, 0],
      },
      pago_mensual: {
        $sum: {
          $map: {
            input: {
              $filter: {
                input: { $ifNull: ["$pago_sucursales", []] },
                as: "pago",
                cond: { $ne: ["$$pago.activo", false] },
              },
            },
            as: "pago",
            in: {
              $add: [
                { $ifNull: ["$$pago.alquiler", 0] },
                { $ifNull: ["$$pago.exhibicion", 0] },
                { $ifNull: ["$$pago.delivery", 0] },
                { $ifNull: ["$$pago.entrega_simple", 0] },
              ],
            },
          },
        },
      },
    },
  },
  {
    $addFields: {
      pago_pendiente: { $subtract: ["$saldo_pendiente", "$deuda"] },
      estado_orden: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $ne: [{ $ifNull: ["$declinacion_servicio_fecha", null] }, null] },
                  { $gte: ["$fecha_vigencia", dayjs().startOf("day").subtract(5, "day").toDate()] },
                ],
              },
              then: 2,
            },
            {
              case: {
                $and: [
                  { $gte: ["$fecha_vigencia", dayjs().startOf("day").toDate()] },
                  { $eq: [{ $ifNull: ["$declinacion_servicio_fecha", null] }, null] },
                ],
              },
              then: 1,
            },
            {
              case: {
                $and: [
                  { $gte: ["$fecha_vigencia", dayjs().startOf("day").subtract(20, "day").toDate()] },
                  { $lt: ["$fecha_vigencia", dayjs().startOf("day").toDate()] },
                  { $eq: [{ $ifNull: ["$declinacion_servicio_fecha", null] }, null] },
                ],
              },
              then: 3,
            },
          ],
          default: 4,
        },
      },
    },
  },
  {
    $project: {
      salesMetrics: 0,
      simplePackageMetrics: 0,
      debtMetrics: 0,
    },
  },
];

const findWithDebtsAndSalesPage = async (params?: SellerListQueryParams) => {
  const match = buildSellerListMatch(params);
  const page = Math.max(1, Number(params?.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize || 10)));
  const skip = (page - 1) * pageSize;
  const pendingMatch =
    params?.pendingPayment === "con_deuda"
      ? { pago_pendiente: { $ne: 0 } }
      : params?.pendingPayment === "sin_deuda"
      ? { pago_pendiente: 0 }
      : null;
  const assignedPaymentSortDirection: 1 | -1 = params?.sortOrder === "desc" ? -1 : 1;
  const sortFieldByParam: Record<string, string> = {
    nombre: "nombre",
    estado: "estado_orden",
    pago_pendiente: "pago_pendiente",
    fecha_vigencia: "fecha_vigencia",
    fecha_pago_asignada: "fecha_pago_asignada",
    pago_mensual: "pago_mensual",
    comision_porcentual: "comision_porcentual",
    emite_factura: "emite_factura",
  };
  const sortField = params?.sortBy ? sortFieldByParam[params.sortBy] : "";
  const sortStage: Record<string, 1 | -1> = sortField
    ? {
        [sortField]: assignedPaymentSortDirection,
        nombre: 1,
        apellido: 1,
        _id: 1,
      }
    : { nombre: 1, apellido: 1, _id: 1 };

  const result = await VendedorModel.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    ...buildSellerMetricsStages(),
    ...(pendingMatch ? [{ $match: pendingMatch }] : []),
    { $sort: sortStage },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: pageSize }],
        meta: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              totalPendingPayment: { $sum: "$pago_pendiente" },
            },
          },
        ],
      },
    },
    {
      $project: {
        rows: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$meta.total", 0] }, 0] },
        totalPendingPayment: {
          $ifNull: [{ $arrayElemAt: ["$meta.totalPendingPayment", 0] }, 0],
        },
      },
    },
  ]).exec();

  const data = result[0] || {};
  return {
    data: data.rows || [],
    total: data.total || 0,
    page,
    pageSize,
    totalPendingPayment: data.totalPendingPayment || 0,
  };
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
  findWithDebtsAndSalesPage,
};
