import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { Types } from "mongoose";
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { SaleService } from "./sale.service";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import dayjs from 'dayjs';

const getAllShippings = async () => {
  return await ShippingRepository.findAll();
};

const getShippingByIds = async (shippingIds: string[]) => {
  const shippings = await ShippingRepository.findByIds(shippingIds);
  if (!shippings.length)
    throw new Error(`No shippings found for the provided IDs`);
  return shippings;
};

const registerShipping = async (shipping: any) => {
  return await ShippingRepository.registerShipping(shipping);
};
const getShippingById = async (id: string) => {
  return await ShippingRepository.findById(id);
};

const actualizarSaldoVendedor = async (
  ventas: {
    id_vendedor: string;
    utilidad: number;
    id_pedido?: string;
    subtotal: number;
    pagado_al_vendedor: boolean;
  }[]
) => {

  const vendedoresMap = new Map<string, number>();
  const pedidosProcesados = new Set();

  for (const venta of ventas) {
    const { id_vendedor, utilidad, id_pedido, subtotal, pagado_al_vendedor } = venta;
    let saldoPendiente = 0;
    if (!id_pedido) {
      throw new Error("id_pedido is required for calculating saldo pendiente");
    }

    const pedido = await PedidoModel.findById(id_pedido)
      .select("adelanto_cliente cargo_delivery pagado_al_vendedor")
      .lean();

    if (!pedido) {
      console.error(`❌ Pedido con id ${id_pedido} no encontrado`);
      continue;
    }


    if (pedido.pagado_al_vendedor) {
      saldoPendiente = -utilidad;
      console.log(`→ Pagado al vendedor: saldoPendiente = -utilidad (${-utilidad})`);
    } else {
      saldoPendiente = subtotal - utilidad;
      console.log(`→ No pagado: saldoPendiente = subtotal - utilidad (${subtotal} - ${utilidad} = ${saldoPendiente})`);
    }

    if (!pedidosProcesados.has(id_pedido)) {
      const adelanto = pedido.adelanto_cliente || 0;
      const delivery = pedido.cargo_delivery || 0;
      saldoPendiente -= adelanto;
      saldoPendiente -= delivery;

      pedidosProcesados.add(id_pedido);
    } 

    const currentSaldo = vendedoresMap.get(id_vendedor) || 0;
    vendedoresMap.set(id_vendedor, currentSaldo + saldoPendiente);
    console.log(`→ Updated vendedor ${id_vendedor} accumulated saldo: ${currentSaldo + saldoPendiente}`);
  }

  // Actualizar el saldo pendiente de cada vendedor
  for (const [id_vendedor, saldoTotal] of vendedoresMap.entries()) {
  if (!id_vendedor || typeof id_vendedor !== "string" || id_vendedor.length !== 24) {
    console.error(`❌ ID de vendedor inválido: ${id_vendedor}`);
    continue;
  }

  const vendedorBefore = await VendedorModel.findById(id_vendedor).lean();
  console.log(`→ Current saldo_pendiente: ${vendedorBefore?.saldo_pendiente}`);

  await VendedorModel.findByIdAndUpdate(id_vendedor, {
    $inc: { saldo_pendiente: saldoTotal },
  });

  const vendedorAfter = await VendedorModel.findById(id_vendedor).lean();
  console.log(`→ New saldo_pendiente: ${vendedorAfter?.saldo_pendiente}`);
}

};

const registerSaleToShipping = async (
  shippingId: string,
  saleWithoutShippingId: any
) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  const sale = new VentaModel({
    ...saleWithoutShippingId,
    pedido: new Types.ObjectId(shipping._id),
    id_pedido: shipping._id,
    producto: new Types.ObjectId(saleWithoutShippingId.id_producto),
    vendedor: new Types.ObjectId(saleWithoutShippingId.id_vendedor),
    sucursal: new Types.ObjectId(saleWithoutShippingId.sucursal),
  });

  const nuevaVenta = await SaleRepository.registerSale(sale);

  const yaExiste = shipping.venta?.some((ventaId: Types.ObjectId) =>
    ventaId.equals(nuevaVenta._id)
  );

  if (!yaExiste) {
    await PedidoModel.findByIdAndUpdate(shipping._id, {
      $push: { venta: nuevaVenta._id },
    });
  }

  await VendedorModel.findByIdAndUpdate(nuevaVenta.vendedor, {
    $push: { venta: nuevaVenta._id },
  });

  return nuevaVenta;
};

const updateShipping = async (newData: any, shippingId: string) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  if (newData.estado_pedido === "Entregado") {
    const sales = await SaleService.getSalesByShippingId(shippingId);
    const salesToUpdateSaldo: any = [];
    sales.forEach((sale) => {
      if (newData.pagado_al_vendedor) {
        salesToUpdateSaldo.push({
          id_vendedor: sale.id_vendedor.toString(),
          utilidad: sale.utilidad,
          id_pedido: shippingId,
          subtotal: 0,
          pagado_al_vendedor: true,
        });
      } else {
        const subtotal = sale.cantidad * sale.precio_unitario;
        salesToUpdateSaldo.push({
          id_vendedor: sale.id_vendedor.toString(),
          utilidad: sale.utilidad,
          id_pedido: shippingId,
          subtotal: subtotal,
          pagado_al_vendedor: false,
        });
      }
    });

    if (salesToUpdateSaldo.length > 0) {
      await actualizarSaldoVendedor(salesToUpdateSaldo);
    }
  }

  const resShip = await ShippingRepository.updateShipping(newData, shippingId);
  return resShip;
};

const getShippingsBySellerService = async (sellerId: string) => {
  const salesBySeller = await SaleRepository.findBySellerId(sellerId);

  const uniqueShippings: IPedidoDocument[] = [];
  const checkedShippings: { [key: string]: boolean } = {};

  for (const sale of salesBySeller) {
    const pedidoPopulado = await sale.populate("pedido");
    const pedidoId = pedidoPopulado.pedido?._id?.toString();

    if (pedidoId && !checkedShippings[pedidoId]) {
      checkedShippings[pedidoId] = true;
      uniqueShippings.push(pedidoPopulado.pedido as IPedidoDocument);
    }
  }

  return uniqueShippings;
};

const addTemporaryProductsToShipping = async (
  shippingId: string,
  productosTemporales: any[]
) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  await PedidoModel.findByIdAndUpdate(shippingId, {
    $set: {
      productos_temporales: productosTemporales,
    },
  });
};

const deleteShippingById = async (id: string) => {
  const pedido = await PedidoModel.findById(id);
  if (!pedido) throw new Error("Pedido no encontrado");

  if (pedido.venta && pedido.venta.length > 0) {
    const ventas = await VentaModel.find({ _id: { $in: pedido.venta } });

    for (const venta of ventas) {
      if (venta.vendedor) {
        await VendedorModel.findByIdAndUpdate(venta.vendedor, {
          $pull: { venta: venta._id },
        });
      }

      await VentaModel.findByIdAndDelete(venta._id);
    }
  }

  await ShippingRepository.deleteById(id);
  return { success: true };
};

const processSalesForShipping = async (shippingId: string, sales: any[]) => {
  const savedSales = [];
  const salesToUpdateSaldo = [];

  for (let sale of sales) {
    let productId = sale.id_producto;

    // 🔄 Si no tiene id_producto válido, crearlo como temporal
    if (!productId || productId.length !== 24) {
      const nuevoProducto = await ProductoModel.create({
      nombre_producto: sale.nombre_variante || sale.producto,
      id_vendedor: sale.id_vendedor,
      id_categoria: sale.id_categoria || undefined,
      esTemporal: true,
      sucursales: [{
        id_sucursal: sale.sucursal,
        combinaciones: [{
          variantes: {
            Variante: "Temporal" // 👈 etiqueta por defecto
          },
          precio: sale.precio_unitario,
          stock: sale.cantidad || 1
        }]
      }]
    });

      productId = nuevoProducto._id;
    }

    const venta = await registerSaleToShipping(shippingId, {
      ...sale,
      id_producto: productId,
      producto: productId,
      sucursal: sale.sucursal || sale.id_sucursal,
    });

    savedSales.push(venta);

    const pedido = await PedidoModel.findById(shippingId).lean();

    if (pedido?.estado_pedido === "Entregado" || pedido?.estado_pedido === "interno") {
      const subtotal = venta.cantidad * venta.precio_unitario;
      salesToUpdateSaldo.push({
        id_vendedor: String(venta.id_vendedor),
        utilidad: venta.utilidad,
        id_pedido: shippingId,
        subtotal: pedido.pagado_al_vendedor ? 0 : subtotal,
        pagado_al_vendedor: pedido.pagado_al_vendedor
      });
    }
  }

  await actualizarSaldoVendedor(salesToUpdateSaldo);

  return { success: true, ventas: savedSales };
};
const getDailySalesHistory = async (date: string | undefined, sucursalId: string) => {
  const startOfDay = date ? dayjs(date).startOf('day').toDate() : null;
  const endOfDay = date ? dayjs(date).endOf('day').toDate() : null;

  const filter: any = {
    $or: [
      { sucursal: sucursalId },
      { lugar_origen: sucursalId }
    ],
    estado_pedido: { $ne: "En Espera" } // ⬅️ filtrar los "En Espera"
  };

  if (startOfDay && endOfDay) {
  filter.fecha_pedido = { $gte: startOfDay, $lte: endOfDay };
  } else {
    // Si no hay fecha seleccionada, solo mostrar hasta hoy
    filter.fecha_pedido = { $lte: new Date() };
  }
  //console.log("📅 Filtro aplicado:", filter);

  const pedidos = await PedidoModel.find(filter)
    .populate({
      path: 'venta',
      populate: [
        { path: 'vendedor', select: 'nombre apellido' },
        { path: 'producto', select: 'nombre_producto' }
      ]
    })
    .sort({ fecha_pedido: -1 })
    .lean();

    
  const resumen = pedidos.map(p => {
    const ventasNormales = (Array.isArray(p.venta) ? p.venta : []).filter((v: any) =>
      v && typeof v === 'object' &&
      typeof v.precio_unitario === 'number' &&
      typeof v.cantidad === 'number'
    );

    const ventasTemporales = (Array.isArray(p.productos_temporales) ? p.productos_temporales : []).filter((v: any) =>
      v && typeof v === 'object' &&
      typeof v.precio_unitario === 'number' &&
      typeof v.cantidad === 'number'
    );

    const montoTotal = [...ventasNormales, ...ventasTemporales].reduce(
      (acc, v: any) => acc + (v.precio_unitario * v.cantidad), 0
    );

    return {
      fecha: p.fecha_pedido,
      hora: dayjs(p.fecha_pedido).format("HH:mm"),
      tipo_de_pago: p.tipo_de_pago,
      monto_total: montoTotal,
      subtotal_efectivo: p.subtotal_efectivo || 0,
      subtotal_qr: p.subtotal_qr || 0,
      esta_pagado: p.esta_pagado
    };
  });

  const totales = resumen.reduce((acc, curr) => {
    acc.efectivo += curr.subtotal_efectivo;
    acc.qr += curr.subtotal_qr;
    return acc;
  }, { efectivo: 0, qr: 0 });

  return { resumen, totales };
};


export const ShippingService = {
  getAllShippings,
  getShippingByIds,
  registerShipping,
  registerSaleToShipping,
  updateShipping,
  getShippingById,
  getShippingsBySellerService,
  addTemporaryProductsToShipping,
  deleteShippingById,
  processSalesForShipping,
  getDailySalesHistory
};
