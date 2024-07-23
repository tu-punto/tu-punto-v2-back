import { ShippingRepository } from "../repositories/shipping.repository";

const getAllShippings = async () => {
    return await ShippingRepository.findAll();
};
const registerShipping = async (shipping: any) => {
    return await ShippingRepository.registerShipping(shipping);
};
export const ShippingService = {
    getAllShippings,
    registerShipping
}