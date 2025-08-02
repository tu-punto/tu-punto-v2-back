import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { IVentaExterna } from "../entities/IVentaExterna";
import { IVentaExternaDocument } from "../entities/documents/IVentaExternaDocument";

const getAllExternalSales = async (): Promise<IVentaExternaDocument[]> => {
    return await VentaExternaModel.find().populate(
        'sucursal'
    )
}

const registerExternalSale = async (externalSale: IVentaExterna): Promise<IVentaExternaDocument> => {
    const newSale = new VentaExternaModel(externalSale);
    console.log(externalSale)
    const saved = await newSale.save();
    
    return saved;
}

const deleteExternalSaleByID = async (externalSaleID: string) => {
    return await VentaExternaModel.findByIdAndDelete(externalSaleID);
}

export const ExternalSaleRepository = {
    getAllExternalSales,
    registerExternalSale,
    deleteExternalSaleByID
};