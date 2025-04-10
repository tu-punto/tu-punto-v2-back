import { IPedidoDocument } from "../entities/documents/IPedidoDocument";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { Types } from 'mongoose';
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";

const getAllShippings = async () => {
  return await ShippingRepository.findAll();
};

const getShippingByIds = async (shippingIds: number[]) => {
  const shippings = await ShippingRepository.findByIds(shippingIds);
  if (!shippings.length)
    throw new Error(`No shippings found for the provided IDs`);
  return shippings;
};
const registerShipping = async (shipping: any) => {
  return await ShippingRepository.registerShipping(shipping);
};

const registerSaleToShipping = async (
  shippingId: number,
  saleWithoutShippingId: any
) => {
  const shipping = await ShippingRepository.findById(shippingId);

  if (!shipping) {
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);
  }

  const sale = new VentaModel({
    ...saleWithoutShippingId,
    pedido: new Types.ObjectId(shipping._id), // Asegura que sea ObjectId
    id_pedido: shippingId // Esto es si usas id_pedido además del ref
  });

  return await SaleRepository.registerSale(sale);
};

const updateShipping = async (newData: any, shippingId: number) => {
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
