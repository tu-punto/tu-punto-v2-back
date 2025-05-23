import { PedidoModel } from "../entities/implements/PedidoSchema";
import { IPedido } from "../entities/IPedido";
import { IPedidoDocument } from "../entities/documents/IPedidoDocument";

const findAll = async (): Promise<IPedidoDocument[]> => {
  const pedidos = await PedidoModel.find().populate(['venta', 'sucursal', 'trabajador']);
  return pedidos;
};

const findById = async (shippingId: string): Promise<IPedidoDocument | null> => {
  return await PedidoModel.findById(shippingId).populate(['venta', 'sucursal', 'trabajador']);
};

const findByIds = async (shippingIds: string[]): Promise<IPedidoDocument[]> => {
  const pedidos = await PedidoModel.find({ id_pedido: { $in: shippingIds } }).populate(['venta', 'sucursal', 'trabajador']);
  return pedidos;
};

const registerShipping = async (shipping: IPedido): Promise<IPedidoDocument> => {
  const newShipping = new PedidoModel(shipping);
  const saved = await newShipping.save();
  return saved;
};

const updateShipping = async (newData: Partial<IPedido>, shipping: IPedido): Promise<IPedidoDocument | null> => {
  const updated = await PedidoModel.findOneAndUpdate(
    { id_pedido: shipping.id_pedido },
    { ...shipping, ...newData },
    { new: true }
  );
  return updated;
};

export const ShippingRepository = {
  findAll,
  registerShipping,
  findById,
  findByIds,
  updateShipping,
};

  