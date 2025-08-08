import { GuiaEnviosModel } from "../entities/implements/GuiaEnvioSchema";
import { IGuiaEnvio } from "../entities/IGuiaEnvio";
import { IGuiaEnvioDocument } from "../entities/documents/IGuiaEnvioDocument";
import { Types } from 'mongoose';

const getAllShippings = async (): Promise<IGuiaEnvioDocument[]> => {
    return await GuiaEnviosModel.find().populate('vendedor')
}

const getSellerShippings = async (sellerID: string): Promise<IGuiaEnvioDocument[]> => {
    if (!Types.ObjectId.isValid(sellerID)) {
        throw new Error("ID de vendedor no válido");
    }
    
    const sellerObjectId = new Types.ObjectId(sellerID);
    return await GuiaEnviosModel.find({ vendedor: sellerObjectId }).populate('vendedor');
};

const uploadShipping = async(shippingGuide: IGuiaEnvio): Promise<IGuiaEnvioDocument> => {
    const newShippingGuide = new GuiaEnviosModel(shippingGuide);
    console.log(shippingGuide)
    const saved = await newShippingGuide.save()

    return saved;
}

export const ShippingGuideRepository = {
    getAllShippings,
    getSellerShippings,
    uploadShipping,
}