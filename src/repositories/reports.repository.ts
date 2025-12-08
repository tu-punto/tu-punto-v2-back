import { PedidoModel } from "../entities/implements/PedidoSchema";
import { Types } from "mongoose";


export const ReportsRepository = {
  async fetchPedidosMensual(opts: {
    start: Date; end: Date; sucursalIds?: string[];
  }) {
    const { start, end, sucursalIds } = opts;

    const filter:any = {
      fecha_pedido: { $gte: start, $lt: end },
      estado_pedido: { $ne: "En Espera" }
    };

    if (sucursalIds?.length) {
      const _ids = sucursalIds.map(id => new Types.ObjectId(id));
      filter.$or = [
        { sucursal: { $in: _ids } },
        { lugar_origen: { $in: _ids } }
      ];
    }
    return await PedidoModel.find(filter, {
      cliente: 1,
      telefono_cliente: 1,
      fecha_pedido: 1,
      hora_entrega_real: 1,
      subtotal_qr: 1,
      subtotal_efectivo: 1,
      cargo_delivery: 1,
      costo_delivery: 1,
      estado_pedido: 1,
      sucursal: 1,
      lugar_origen: 1,
      productos_temporales: 1,
      venta: 1
    })
    .populate([
      { path: "sucursal", select: "nombre" },
      { path: "lugar_origen", select: "nombre" },
      { path: "venta",
        populate: [
          { path: "vendedor", select: "nombre apellido" },
          { path: "producto", select: "nombre_producto" }
        ]
      }
    ])
    .lean()
    .exec();
  }
};
