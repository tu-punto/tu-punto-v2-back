import { PedidoModel } from "../entities/implements/PedidoSchema";
import { IPedido } from "../entities/IPedido";
import { IPedidoDocument } from "../entities/documents/IPedidoDocument";

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



const findById = async (shippingId: string): Promise<IPedidoDocument | null> => {
  return await PedidoModel.findById(shippingId).populate(shippingPopulate);
};

const findByIds = async (shippingIds: string[]): Promise<IPedidoDocument[]> => {
  const pedidos = await PedidoModel.find({ _id: { $in: shippingIds } }).populate(shippingPopulate);
  return pedidos;
};

const findByDateRange = async (
  from?: Date,
  to?: Date
): Promise<IPedidoDocument[]> => {
  if (!from && !to) return await findAll();

  const match: any = {};
  match.fecha_pedido = {};
  if (from) match.fecha_pedido.$gte = from;
  if (to) match.fecha_pedido.$lte = to;

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
  findByDateRange,
  registerShipping,
  findById,
  findByIds,
  updateShipping,
  deleteById,
};

  