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

const updateExternalSaleByID = async (id: string, externalSale: IVentaExterna): Promise<IVentaExternaDocument | null> => {
    return await VentaExternaModel.findByIdAndUpdate(
        id,
        externalSale,
        { new: true }
    ).populate('sucursal');
}

export const ExternalSaleRepository = {
    getAllExternalSales,
    registerExternalSale,
    deleteExternalSaleByID,
    updateExternalSaleByID
};