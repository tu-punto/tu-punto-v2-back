import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { IVentaExterna } from "../entities/IVentaExterna";
import { IVentaExternaDocument } from "../entities/documents/IVentaExternaDocument";
import { Types } from "mongoose";

const getAllExternalSales = async (): Promise<IVentaExternaDocument[]> => {
    return await VentaExternaModel.find().populate(
        'sucursal'
    );
}

const getExternalSalesList = async (params: {
    page?: number;
    limit?: number;
    status?: string;
    from?: Date;
    to?: Date;
    sucursalId?: string;
    client?: string;
}) => {
    const safePage = Math.max(1, Number(params.page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(params.limit) || 50));

    const match: any = {};
    if (params.status) {
        match.estado_pedido = params.status;
    }
    if (params.from || params.to) {
        match.fecha_pedido = {};
        if (params.from) match.fecha_pedido.$gte = params.from;
        if (params.to) match.fecha_pedido.$lte = params.to;
    }
    if (params.sucursalId && Types.ObjectId.isValid(params.sucursalId)) {
        match.sucursal = new Types.ObjectId(params.sucursalId);
    }
    if (params.client) {
        match.comprador = { $regex: params.client, $options: "i" };
    }

    const [rows, total] = await Promise.all([
        VentaExternaModel.find(match)
            .sort({ fecha_pedido: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .populate({ path: "sucursal", select: "_id nombre" })
            .lean(),
        VentaExternaModel.countDocuments(match)
    ]);

    return {
        rows,
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.max(1, Math.ceil(total / safeLimit))
    };
}

const getExternalSaleByID = async (id: string): Promise<IVentaExternaDocument | null> => {
    return await VentaExternaModel.findById(id).populate('sucursal');
}

const getExternalSalesByDateRange = async (
    from?: Date,
    to?: Date
): Promise<IVentaExternaDocument[]> => {
    if (!from && !to) return await getAllExternalSales();

    const match: any = {};
    match.fecha_pedido = {};
    if (from) match.fecha_pedido.$gte = from;
    if (to) match.fecha_pedido.$lte = to;

    return await VentaExternaModel.find(match).populate('sucursal');
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
    getExternalSalesList,
    getExternalSaleByID,
    getExternalSalesByDateRange,
    registerExternalSale,
    registerExternalSales,
    deleteExternalSaleByID,
    updateExternalSaleByID
};
