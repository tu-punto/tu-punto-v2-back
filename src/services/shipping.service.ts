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
  if (!shippings.length) throw new Error(`No shippings found for the provided IDs`);
  return shippings;
};

const registerShipping = async (shipping: any) => {
  return await ShippingRepository.registerShipping(shipping);
};

const actualizarSaldoVendedor = async (ventas: {
  id_vendedor: string;
  utilidad: number;
  id_pedido?: string;
}[]) => {
  const vendedoresMap = new Map<string, number>();

  for (const venta of ventas) {
    const { id_vendedor, utilidad, id_pedido } = venta;

    let adelanto = 0;
    if (id_pedido) {
      const pedido = await PedidoModel.findById(id_pedido).select("adelanto_cliente").lean();
      adelanto = pedido?.adelanto_cliente || 0;
      console.log(`→ Adelanto del cliente: ${adelanto}`);
    }

    const saldo = utilidad - adelanto;
    console.log(`→ Vendedor: ${id_vendedor}, Utilidad: ${utilidad}, Saldo a incrementar: ${saldo}`);

    vendedoresMap.set(id_vendedor, (vendedoresMap.get(id_vendedor) || 0) + saldo);
  }

  for (const [id_vendedor, saldoTotal] of vendedoresMap.entries()) {
    console.log(`✅ Actualizando saldo_pendiente de vendedor ${id_vendedor} con: ${saldoTotal}`);
    await VendedorModel.findByIdAndUpdate(id_vendedor, {
      $inc: { saldo_pendiente: saldoTotal },
    });
  }
};

const registerSaleToShipping = async (shippingId: string, saleWithoutShippingId: any) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping) throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  const sale = new VentaModel({
    ...saleWithoutShippingId,
    pedido: new Types.ObjectId(shipping._id),
    id_pedido: shipping._id,
    producto: new Types.ObjectId(saleWithoutShippingId.id_producto),
    vendedor: new Types.ObjectId(saleWithoutShippingId.id_vendedor),
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

  // Verifica correctamente el estado del pedido
  const pedido = await PedidoModel.findById(shipping._id).lean();
if (pedido?.estado_pedido === "Entregado" || pedido?.estado_pedido === "interno") {
  console.log(" Pedido entregado, actualizando saldo vendedor...");
  await actualizarSaldoVendedor([
    {
      id_vendedor: saleWithoutShippingId.id_vendedor,
      utilidad: saleWithoutShippingId.utilidad,
      id_pedido: shipping._id.toString(),
    },
  ]);
} else {
  console.log(` Pedido aún no entregado, estado actual: ${pedido?.estado_pedido}`);
}


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
  if (!shipping) throw new Error(`Shipping with id ${shippingId} doesn't exist`);

  await PedidoModel.findByIdAndUpdate(shippingId, {
    $push: {
      productos_temporales: { $each: productosTemporales },
    },
  });
};

export const ShippingService = {
  getAllShippings,
  getShippingByIds,
  registerShipping,
  registerSaleToShipping,
  updateShipping,
  getShippingsBySellerService,
  addTemporaryProductsToShipping,
};
