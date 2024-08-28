import { PedidoEntity } from "../entities/implements/PedidoEntity";
import { VentaEntity } from "../entities/implements/VentaEntity";
import { Venta } from "../models/Venta";
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
  if (!shipping)
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);
  const sale = new Venta({ ...saleWithoutShippingId });
  sale.pedido = shipping;
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
  console.log(salesBySeller, "test");
  const uniqueShippings: PedidoEntity[] = [];
  const checkedShippings: { [key: number]: boolean } = {};
  salesBySeller.forEach((sale: VentaEntity) => {
    if (!checkedShippings[sale.id_pedido]) {
      checkedShippings[sale.id_pedido] = true;
      uniqueShippings.push(sale.pedido);
    }
  });
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
