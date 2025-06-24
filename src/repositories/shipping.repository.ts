import { PedidoModel } from "../entities/implements/PedidoSchema";
import { IPedido } from "../entities/IPedido";
import { IPedidoDocument } from "../entities/documents/IPedidoDocument";

const findAll = async (): Promise<IPedidoDocument[]> => {
  return await PedidoModel.find().populate([
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
  ]);
};



const findById = async (shippingId: string): Promise<IPedidoDocument | null> => {
  return await PedidoModel.findById(shippingId).populate([
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
  ]);
};

const findByIds = async (shippingIds: string[]): Promise<IPedidoDocument[]> => {
  const pedidos = await PedidoModel.find({ _id: { $in: shippingIds } }).populate([
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
  ]);
  return pedidos;
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
  registerShipping,
  findById,
  findByIds,
  updateShipping,
  deleteById,
};

  