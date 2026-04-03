import { PedidoModel } from "../entities/implements/PedidoSchema";
import { IPedido } from "../entities/IPedido";
import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { Types } from "mongoose";
import { VentaModel } from "../entities/implements/VentaSchema";

const shippingPopulate = [
  {
    path: 'venta',
    populate: [
      {
        path: 'vendedor',
        select: 'nombre apellido',
      },
      {
        path: 'producto',
        select: 'nombre_producto esTemporal',
      }
    ],
  },
  'sucursal',
  'trabajador',
  'lugar_origen',
];

const findAll = async (): Promise<IPedidoDocument[]> => {
  return await PedidoModel.find().populate(shippingPopulate);
};

type ShippingListParams = {
  page?: number;
  limit?: number;
  status?: string;
  from?: Date;
  to?: Date;
  originId?: string;
  sellerId?: string;
  client?: string;
};

const findList = async (params: ShippingListParams) => {
  const safePage = Math.max(1, Number(params.page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(params.limit) || 50));

  const filter: any = {};

  if (params.status) {
    filter.estado_pedido = params.status;
  }

  if (params.from || params.to) {
    filter.hora_entrega_acordada = {};
    if (params.from) filter.hora_entrega_acordada.$gte = params.from;
    if (params.to) filter.hora_entrega_acordada.$lte = params.to;
  }

  if (params.originId && Types.ObjectId.isValid(params.originId)) {
    const originObjectId = new Types.ObjectId(params.originId);
    filter.$or = [{ lugar_origen: originObjectId }, { sucursal: originObjectId }];
  }

  if (params.client) {
    filter.cliente = { $regex: params.client, $options: "i" };
  }

  if (params.sellerId && Types.ObjectId.isValid(params.sellerId)) {
    const sellerObjectId = new Types.ObjectId(params.sellerId);
    const pedidoIdsBySales = await VentaModel.find({ vendedor: sellerObjectId })
      .select("pedido")
      .lean();
    const salesPedidoIds = pedidoIdsBySales
      .map((item: any) => item.pedido)
      .filter(Boolean);

    const sellerMatch = {
      $or: [
        { _id: { $in: salesPedidoIds } },
        { "productos_temporales.id_vendedor": sellerObjectId }
      ]
    };

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, sellerMatch];
      delete filter.$or;
    } else {
      Object.assign(filter, sellerMatch);
    }
  }

  const [rows, total] = await Promise.all([
    PedidoModel.find(filter)
      .sort({ hora_entrega_acordada: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate(shippingPopulate)
      .lean(),
    PedidoModel.countDocuments(filter)
  ]);

  return {
    rows,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit))
  };
};



const findById = async (shippingId: string): Promise<IPedidoDocument | null> => {
  return await PedidoModel.findById(shippingId).populate(shippingPopulate);
};

const findByIds = async (shippingIds: string[]): Promise<IPedidoDocument[]> => {
  const pedidos = await PedidoModel.find({ _id: { $in: shippingIds } }).populate(shippingPopulate);
  return pedidos;
};

const findByDateRange = async (
  from?: Date,
  to?: Date,
  sucursalIds?: string[]
): Promise<IPedidoDocument[]> => {
  const validSucursalIds = (sucursalIds || []).filter((id) => Types.ObjectId.isValid(id));
  if (!from && !to && !validSucursalIds.length) return await findAll();

  const match: any = {};
  if (from || to) {
    match.fecha_pedido = {};
    if (from) match.fecha_pedido.$gte = from;
    if (to) match.fecha_pedido.$lte = to;
  }
  if (validSucursalIds.length) {
    const branchObjectIds = validSucursalIds.map((id) => new Types.ObjectId(id));
    match.$or = [
      { sucursal: { $in: branchObjectIds } },
      { lugar_origen: { $in: branchObjectIds } },
    ];
  }

  return await PedidoModel.find(match).populate(shippingPopulate);
};


const registerShipping = async (shipping: IPedido): Promise<IPedidoDocument> => {
  const newShipping = new PedidoModel(shipping);
  const saved = await newShipping.save();
  return saved;
};

const updateShipping = async (newData: Partial<IPedido>, shippingId: string): Promise<IPedidoDocument | null> => {
  return await PedidoModel.findByIdAndUpdate(
    shippingId,
    { $set: newData },
    { new: true }
  );
};
const deleteById = async (shippingId: string) => {
  return await PedidoModel.findByIdAndDelete(shippingId);
};



export const ShippingRepository = {
  findAll,
  findList,
  findByDateRange,
  registerShipping,
  findById,
  findByIds,
  updateShipping,
  deleteById,
};

  
