import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { Types } from "mongoose";
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";
import { VendedorModel } from "../entities/implements/VendedorSchema";

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
  }[]
) => {
  const vendedoresMap = new Map<string, number>();
  const pedidosProcesados = new Set();

  for (const venta of ventas) {
    const { id_vendedor, utilidad, id_pedido, subtotal } = venta;

    let saldoPendiente = 0;
    if (!id_pedido) {
      throw new Error("id_pedido is required for calculating saldo pendiente");
    }
    const pedido = await PedidoModel.findById(id_pedido)
      .select("adelanto_cliente cargo_delivery pagado_al_vendedor")
      .lean();

    if (!pedido) {
      console.error(`Pedido con id ${id_pedido} no encontrado`);
      continue;
    }

    if (pedido.pagado_al_vendedor) {
      saldoPendiente = -utilidad; 
    } else {
      saldoPendiente = subtotal - utilidad; 
    }

    if (!pedidosProcesados.has(id_pedido)) {
      // Restar adelanto del cliente y cargo de delivery solo una vez por pedido
      saldoPendiente -= pedido.adelanto_cliente || 0;
      saldoPendiente -= pedido.cargo_delivery || 0;

      console.log(
        `→ Pedido procesado: ${id_pedido}, Saldo pendiente calculado: ${saldoPendiente}`
      );
      pedidosProcesados.add(id_pedido);
    } else {
      console.log(`→ Pedido ya procesado: ${id_pedido}`);
    }

    // Acumular el saldo pendiente para el vendedor
    vendedoresMap.set(
      id_vendedor,
      (vendedoresMap.get(id_vendedor) || 0) + saldoPendiente
    );
  }

  // Actualizar el saldo pendiente de cada vendedor
  for (const [id_vendedor, saldoTotal] of vendedoresMap.entries()) {
    console.log(
      `✅ Actualizando saldo_pendiente de vendedor ${id_vendedor} con: ${saldoTotal}`
    );
    await VendedorModel.findByIdAndUpdate(id_vendedor, {
      $inc: { saldo_pendiente: saldoTotal },
    });
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
  return await ShippingRepository.updateShipping(newData, shippingId);
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

const processSalesForShipping = async (shippingId: string, sales: any[]) => {
  const savedSales = [];
  const productosTemporales: any[] = [];
  const salesToUpdatesaldo = [];

  for (let sale of sales) {
    const esTemporal = !sale.id_producto || sale.id_producto.length !== 24;

    if (esTemporal) {
      productosTemporales.push({
        producto: sale.producto,
        cantidad: sale.cantidad,
        precio_unitario: sale.precio_unitario,
        utilidad: sale.utilidad,
        id_vendedor: sale.id_vendedor,
      });
    } else {
      const saleShipping = await registerSaleToShipping(shippingId, sale);
      savedSales.push(saleShipping);

      // Actualizar saldo del vendedor si el pedido no ha sido procesado
      const pedido = await PedidoModel.findById(shippingId).lean();
      if (
        pedido?.estado_pedido === "Entregado" ||
        pedido?.estado_pedido === "interno"
      ) {
        salesToUpdatesaldo.push({
          id_vendedor: sale.id_vendedor,
          utilidad: sale.utilidad,
          id_pedido: shippingId,
          subtotal: sale.cantidad * sale.precio_unitario,
        });
      }
    }
  }

  await actualizarSaldoVendedor(salesToUpdatesaldo);

  // Guardamos productos temporales directamente en el pedido
  if (productosTemporales.length > 0) {
    await addTemporaryProductsToShipping(shippingId, productosTemporales);
  }

  return { success: true, ventas: savedSales };
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
  processSalesForShipping,
};
