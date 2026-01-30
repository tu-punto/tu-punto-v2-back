// src/repositories/reports.repository.ts
import { Types } from "mongoose";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema"; // 👈 asegúrate de tenerlo
import { VendedorModel } from "../entities/implements/VendedorSchema"; // 👈 asegúrate de tenerlo
export const ReportsRepository = {
  async fetchPedidosConVentasEnRango(opts: { start: Date; end: Date; sucursalIds?: string[] }) {
    const { start, end, sucursalIds } = opts;

    const filter: any = {
      fecha_pedido: { $gte: start, $lt: end },
      estado_pedido: { $ne: "En Espera" },
    };

    if (sucursalIds?.length) {
      const _ids = sucursalIds.map((id) => new Types.ObjectId(id));
      filter.$or = [{ sucursal: { $in: _ids } }, { lugar_origen: { $in: _ids } }];
    }

    return await PedidoModel.find(
      filter,
      {
        fecha_pedido: 1,
        hora_entrega_real: 1,
        sucursal: 1,
        lugar_origen: 1,
        venta: 1,
      },
    )
      .populate([{ path: "venta", select: "utilidad sucursal" }])
      .lean()
      .exec();
  },

  async fetchPedidosMensual(opts: { start: Date; end: Date; sucursalIds?: string[] }) {
    const { start, end, sucursalIds } = opts;

    const filter: any = {
      fecha_pedido: { $gte: start, $lt: end },
      estado_pedido: { $ne: "En Espera" },
    };

    if (sucursalIds?.length) {
      const _ids = sucursalIds.map((id) => new Types.ObjectId(id));
      filter.$or = [{ sucursal: { $in: _ids } }, { lugar_origen: { $in: _ids } }];
    }

    return await PedidoModel.find(
      filter,
      {
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
        venta: 1,
      },
    )
      .populate([
        { path: "sucursal", select: "nombre" },
        { path: "lugar_origen", select: "nombre" },
        {
          path: "venta",
          populate: [
            { path: "vendedor", select: "nombre apellido" },
            { path: "producto", select: "nombre_producto categoria", populate: [{ path: "categoria", select: "categoria" }] },
          ],
        },
      ])
      .lean()
      .exec();
  },

  async fetchComisionesPorMesYSucursal(opts: { start: Date; end: Date; sucursalIds?: string[] }) {
    const { start, end, sucursalIds } = opts;

    const matchSuc: any = {};
    if (sucursalIds?.length) {
      matchSuc.sucursal = { $in: sucursalIds.map((id) => new Types.ObjectId(id)) };
    }

    return await VentaModel.aggregate([
      { $match: { ...matchSuc } },
      {
        $lookup: {
          from: "Pedido",
          localField: "pedido",
          foreignField: "_id",
          as: "pedidoDoc",
        },
      },
      { $unwind: "$pedidoDoc" },
      { $match: { "pedidoDoc.fecha_pedido": { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            sucursal: "$sucursal",
            mes: { $dateToString: { format: "%Y-%m", date: "$pedidoDoc.fecha_pedido" } },
          },
          comision_bs: { $sum: { $ifNull: ["$utilidad", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          id_sucursal: { $toString: "$_id.sucursal" },
          mes: "$_id.mes",
          comision_bs: { $round: ["$comision_bs", 2] },
        },
      },
      { $sort: { mes: 1, id_sucursal: 1 } },
    ]).exec();
  },

  async fetchStockProductosPorSucursal(opts: { idSucursal: string }) {
    const sucId = new Types.ObjectId(opts.idSucursal);

    return await ProductoModel.aggregate([
      { $match: { esTemporal: false } },
      { $unwind: "$sucursales" },
      { $match: { "sucursales.id_sucursal": sucId } },
      {
        $lookup: {
          from: "Vendedor",
          localField: "id_vendedor",
          foreignField: "_id",
          as: "vendedor",
        },
      },
      { $unwind: { path: "$vendedor", preserveNullAndEmptyArrays: true } },
      { $unwind: "$sucursales.combinaciones" },
      {
        $project: {
          _id: 0,
          id_producto: { $toString: "$_id" },
          nombre_producto: "$nombre_producto",
          id_vendedor: { $toString: "$id_vendedor" },
          vendedor_nombre_completo: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$vendedor.nombre", ""] },
                  " ",
                  { $ifNull: ["$vendedor.apellido", ""] },
                ],
              },
            },
          },
          variantes: "$sucursales.combinaciones.variantes",
          stock: "$sucursales.combinaciones.stock",
        },
      },
      { $sort: { nombre_producto: 1 } },
    ]).exec();
  },
  async fetchIngresosFlujoEnRango(opts: { start: Date; end: Date }) {
  const { start, end } = opts;

  const match: any = {
    tipo: "INGRESO",
    fecha: { $gte: start, $lt: end },
  };

  return await FlujoFinancieroModel.find(match, {
    tipo: 1,
    categoria: 1,
    concepto: 1,
    monto: 1,
    fecha: 1,
    esDeuda: 1,
    id_vendedor: 1,
    id_trabajador: 1,
  })
    .lean()
    .exec();
},
  async fetchGastosOperativosEnRango(opts: { start: Date; end: Date; sucursalIds?: string[] }) {
    const { start, end, sucursalIds } = opts;

    const filter: any = {
      tipo: "GASTO",
      fecha: { $gte: start, $lt: end },
      esDeuda: { $ne: true },
    };

    if (sucursalIds?.length) {
      filter.id_sucursal = { $in: sucursalIds.map((id) => new Types.ObjectId(id)) };
    }

    return await FlujoFinancieroModel.find(
      filter,
      {
        monto: 1,
        fecha: 1,
        categoria: 1,
        concepto: 1,
        id_sucursal: 1,
      },
    )
      .populate([{ path: "id_sucursal", select: "nombre" }])
      .lean()
      .exec();
  },

async fetchVendedoresActivosConPlanes(opts: { hoy: Date }) {
  const { hoy } = opts;

  return await VendedorModel.find(
    {
      fecha_vigencia: { $gte: hoy },
      "pago_sucursales.activo": true,
    },
    {
      nombre: 1,
      apellido: 1,
      mail: 1,
      telefono: 1,
      fecha_vigencia: 1,
      comision_porcentual: 1,
      comision_fija: 1,
      pago_sucursales: 1,
    }
  )
    .lean()
    .exec();
},
async fetchVentas3MPorVendedor(opts: { start: Date; end: Date }) {
  const { start, end } = opts;

  return await VentaModel.aggregate([
    // Venta -> pedido
    {
      $lookup: {
        from: "Pedido",
        localField: "pedido",
        foreignField: "_id",
        as: "p",
      }
    },
    { $unwind: "$p" },

    // rango fecha por pedido
    { $match: { "p.fecha_pedido": { $gte: start, $lt: end }, "p.estado_pedido": { $ne: "En Espera" } } },

    // mes (usa fecha_pedido; si quieres hora_entrega_real, se puede cambiar)
    {
      $addFields: {
        mes: { $dateToString: { format: "%Y-%m", date: "$p.fecha_pedido" } },
        monto_pedido: {
          $add: [
            { $ifNull: ["$p.subtotal_qr", 0] },
            { $ifNull: ["$p.subtotal_efectivo", 0] },
          ]
        }
      }
    },

    // Agrupar por vendedor y mes
    // OJO: esto suma el monto_pedido por cada venta del pedido => DUPLICA si un pedido tiene varias ventas de distintos vendedores.
    // Para evitar duplicación, hay que prorratear o asignar por venta (si tu negocio lo hace).
    {
      $group: {
        _id: { vendedor: "$vendedor", mes: "$mes" },
        monto_bs: { $sum: "$monto_pedido" }
      }
    },

    {
      $project: {
        _id: 0,
        id_vendedor: { $toString: "$_id.vendedor" },
        mes: "$_id.mes",
        monto_bs: { $round: ["$monto_bs", 2] }
      }
    },
    { $sort: { id_vendedor: 1, mes: 1 } }
  ]).exec();
},
async fetchVentasDetalleEnRango(opts: { start: Date; end: Date }) {
  const { start, end } = opts;

  return await VentaModel.aggregate([
    // Venta -> Pedido (para filtrar por rango)
    {
      $lookup: {
        from: "Pedido",
        localField: "pedido",
        foreignField: "_id",
        as: "p",
      },
    },
    { $unwind: "$p" },

    // Filtrar por fecha del pedido (o hora_entrega_real si quieres)
    {
      $match: {
        "p.fecha_pedido": { $gte: start, $lt: end },
        "p.estado_pedido": { $ne: "En Espera" },
      },
    },

    // Join vendedor
    {
      $lookup: {
        from: "Vendedor", // ⚠️ AJUSTA al nombre real de tu colección
        localField: "vendedor",
        foreignField: "_id",
        as: "v",
      },
    },
    { $unwind: { path: "$v", preserveNullAndEmptyArrays: true } },

    // Join producto
    {
      $lookup: {
        from: "Producto",
        localField: "producto",
        foreignField: "_id",
        as: "prod",
      },
    },
    { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },

    // Proyección final (detalle listo para Excel)
    {
      $project: {
        _id: 0,
        fecha: "$p.fecha_pedido",
        id_venta: { $toString: "$_id" },

        id_vendedor: { $toString: "$vendedor" },
        vendedor: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$v.nombre", ""] },
                " ",
                { $ifNull: ["$v.apellido", ""] },
              ],
            },
          },
        },

        id_producto: {
          $cond: [
            { $ifNull: ["$producto", false] },
            { $toString: "$producto" },
            "",
          ],
        },
        producto: { $ifNull: ["$prod.nombre_producto", ""] },

        nombre_variante: { $ifNull: ["$nombre_variante", ""] },
        cantidad: { $ifNull: ["$cantidad", 0] },
        precio_unitario: { $ifNull: ["$precio_unitario", 0] },

        total_bs: {
          $round: [
            { $multiply: [{ $ifNull: ["$cantidad", 0] }, { $ifNull: ["$precio_unitario", 0] }] },
            2,
          ],
        },

        // sucursal del pedido (si tu venta tiene sucursal, puedes preferir esa)
        id_sucursal: {
          $toString: {
            $ifNull: ["$p.sucursal", "$p.lugar_origen"],
          },
        },
      },
    },

    { $sort: { fecha: 1 } },
  ]).exec();
},




};
