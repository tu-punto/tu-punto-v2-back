import { Venta } from "../models/Venta";
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingRepository } from "../repositories/shipping.repository";

const getAllShippings = async () => {
    return await ShippingRepository.findAll();
};
const registerShipping = async (shipping: any) => {
    return await ShippingRepository.registerShipping(shipping);
};

const registerSaleToShipping = async (shippingId: number, saleWithoutShippingId: any) => {
    const shipping = await ShippingRepository.findById(shippingId)
    if (!shipping) throw new Error(`Shipping with id ${shippingId} doesn't exist`);
    const sale = new Venta({ ...saleWithoutShippingId })
    sale.pedido = shipping
    
    return await SaleRepository.registerSale(sale)
}

const updateShipping = async (newData: any, shippingId: number) => {
    const shipping = await ShippingRepository.findById(shippingId)
    if(!shipping) throw new Error(`Shipping with id ${shippingId} doesn't exist`);
    return await ShippingRepository.updateShipping(newData, shipping)
}

export const ShippingService = {
    getAllShippings,
    registerShipping,
    registerSaleToShipping,
    updateShipping
}