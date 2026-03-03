import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { IVentaExterna } from "../entities/IVentaExterna";
import { IVentaExternaDocument } from "../entities/documents/IVentaExternaDocument";

const getAllExternalSales = async (): Promise<IVentaExternaDocument[]> => {
    return await VentaExternaModel.find().populate(
        'sucursal'
    );
}

const getExternalSaleByID = async (id: string): Promise<IVentaExternaDocument | null> => {
    return await VentaExternaModel.findById(id).populate('sucursal');
}

const registerExternalSale = async (externalSale: IVentaExterna): Promise<IVentaExternaDocument> => {
    const newSale = new VentaExternaModel(externalSale);
    const saved = await newSale.save();

    return saved;
}

const registerExternalSales = async (externalSales: IVentaExterna[]): Promise<IVentaExternaDocument[]> => {
    if (!externalSales.length) return [];
    const created = await VentaExternaModel.insertMany(externalSales);
    return created as IVentaExternaDocument[];
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
    getExternalSaleByID,
    registerExternalSale,
    registerExternalSales,
    deleteExternalSaleByID,
    updateExternalSaleByID
};
