import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { Types } from 'mongoose';
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";
import { VendedorModel } from '../entities/implements/VendedorSchema'; // asegúrate de importar el modelo

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

const registerSaleToShipping = async (
  shippingId: string,
  saleWithoutShippingId: any
) => {
  const shipping = await ShippingRepository.findById(shippingId);

  if (!shipping) {
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);
  }

  console.log("Venta a registrar:", {
    shippingId,
    saleWithoutShippingId
  });

  // Crear nueva venta
  const sale = new VentaModel({
  ...saleWithoutShippingId,
  pedido: new Types.ObjectId(shipping._id),
  id_pedido: shipping._id,
});

const nuevaVenta = await SaleRepository.registerSale(sale);

// Verificar si ya está en el array venta del pedido
const yaExiste = shipping.venta?.some((ventaId: Types.ObjectId) =>
  ventaId.equals(nuevaVenta._id)
);

if (!yaExiste) {
  await PedidoModel.findByIdAndUpdate(shipping._id, {
    $push: { venta: nuevaVenta._id }
  });
  console.log(`Venta ${nuevaVenta._id} añadida a pedido ${shipping._id}`);
}

//  Añadir venta al vendedor
await VendedorModel.findByIdAndUpdate(
  nuevaVenta.id_vendedor,
  { $push: { venta: nuevaVenta._id } }
);
console.log(`Venta ${nuevaVenta._id} añadida a vendedor ${nuevaVenta.id_vendedor}`);
  return nuevaVenta;
};
const updateShipping = async (newData: any, shippingId: string) => {
  const shipping = await ShippingRepository.findById(shippingId);
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);
  return await ShippingRepository.updateShipping(newData, shipping);
};

const getShippingsBySellerService = async (sellerId: number) => {
  const salesBySeller = await SaleRepository.findBySellerId(sellerId);

  const uniqueShippings: IPedidoDocument[] = []; 
  const checkedShippings: { [key: string]: boolean } = {}; 

  for (const sale of salesBySeller) {
    const pedidoPopulado = await sale.populate('pedido'); 
    const pedidoId = pedidoPopulado.pedido?.id_pedido?.toString();

    if (pedidoId && !checkedShippings[pedidoId]) {
      checkedShippings[pedidoId] = true;
      uniqueShippings.push(pedidoPopulado.pedido as IPedidoDocument);
    }
  }

  return uniqueShippings;
};

export const ShippingService = {
  getAllShippings,
  getShippingByIds,
  registerShipping,
  registerSaleToShipping,
  updateShipping,
  getShippingsBySellerService,
};
