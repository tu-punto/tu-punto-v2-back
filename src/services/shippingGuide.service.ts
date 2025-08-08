import { ShippingGuideRepository } from "../repositories/shippingGuide.repository";
import moment from 'moment-timezone';

const getAllShippings = async () => {
    return ShippingGuideRepository.getAllShippings();
}

const getSellerShippings = async (sellerID: string) => {
    return await ShippingGuideRepository.getSellerShippings(sellerID);
}

const uploadShipping = async (shippingGuide: any) => {
    if (shippingGuide.fecha_subida) {
        shippingGuide.fecha_subida = moment.tz(shippingGuide.fecha_subida, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss"); 
    }
    if (!shippingGuide.fecha_subida) {
        shippingGuide.fecha_subida = moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
    }

    return await ShippingGuideRepository.uploadShipping(shippingGuide);
}

export const ShippingGuideService = {
    getAllShippings,
    getSellerShippings,
    uploadShipping,
}