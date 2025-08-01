import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { IVentaExterna } from "../entities/IVentaExterna";
import { IVentaExternaDocument } from "../entities/documents/IVentaExternaDocument";

const registerExternalSale = async (externalSale: IVentaExterna): Promise<IVentaExternaDocument> => {
    const newSale = new VentaExternaModel(externalSale);
    console.log(externalSale)
    const saved = await newSale.save();
    
    return saved;
}

export const ExternalSaleRepository = {
    registerExternalSale,
};