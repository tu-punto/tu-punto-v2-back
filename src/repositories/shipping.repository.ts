import { PedidoModel } from "../entities/implements/PedidoSchema";
import { IPedido } from "../entities/IPedido";
import { Pedido } from "../models/Pedido";


const findAll = async (): Promise<Pedido[]> => {
    const pedidos = await PedidoModel.find().populate(['venta', 'sucursal', 'trabajador']);
    return pedidos.map(p => new Pedido(p));
  };
  
  const findById = async (shippingId: number) => {
    return await PedidoModel.findOne({ id_pedido: shippingId }).populate(['venta', 'sucursal', 'trabajador']);
  };
  
  const findByIds = async (shippingIds: number[]): Promise<Pedido[]> => {
    const pedidos = await PedidoModel.find({ id_pedido: { $in: shippingIds } }).populate(['venta', 'sucursal', 'trabajador']);
    return pedidos.map(p => new Pedido(p));
  };
  
  const registerShipping = async (shipping: IPedido): Promise<Pedido> => {
    const newShipping = new PedidoModel(shipping);
    const saved = await newShipping.save();
    return new Pedido(saved);
  };
  
  const updateShipping = async (newData: any, shipping: IPedido) => {
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
    updateShipping
  };
  