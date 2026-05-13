import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { IVentaExterna } from "../entities/IVentaExterna";
import { IVentaExternaDocument } from "../entities/documents/IVentaExternaDocument";
import { Types } from "mongoose";

const EXTERNAL_SERVICE_FILTER = {
    $or: [
        { service_origin: { $exists: false } },
        { service_origin: "external" }
    ]
};

const getAllExternalSales = async (): Promise<IVentaExternaDocument[]> => {
    return await VentaExternaModel.find(EXTERNAL_SERVICE_FILTER)
        .populate('sucursal')
        .populate({ path: "origen_sucursal", select: "_id nombre" })
        .populate({ path: "destino_sucursal", select: "_id nombre" });
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

    const match: any = { ...EXTERNAL_SERVICE_FILTER };
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
        const searchRegex = { $regex: params.client, $options: "i" };
        match.$or = [
            { comprador: searchRegex },
            { telefono_comprador: searchRegex },
            { carnet_comprador: searchRegex },
            { numero_guia: searchRegex }
        ];
    }

    const [rows, total] = await Promise.all([
        VentaExternaModel.find(match)
            .sort({ fecha_pedido: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .populate({ path: "sucursal", select: "_id nombre" })
            .populate({ path: "origen_sucursal", select: "_id nombre" })
            .populate({ path: "destino_sucursal", select: "_id nombre" })
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

export type ExternalContactSuggestionField = "seller_carnet" | "name" | "phone";

export type ExternalContactSuggestion = {
    carnet_vendedor?: string;
    nombre?: string;
    telefono?: string;
    source: "seller" | "buyer";
    lastUsed?: Date;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getExternalContactSuggestions = async (params: {
    query?: string;
    field?: ExternalContactSuggestionField;
    limit?: number;
}): Promise<ExternalContactSuggestion[]> => {
    const query = String(params.query || "").trim();
    if (query.length < 2) return [];

    const safeLimit = Math.min(20, Math.max(1, Number(params.limit) || 8));
    const regex = new RegExp(escapeRegex(query), "i");
    const field = params.field || "name";
    const match: any = { ...EXTERNAL_SERVICE_FILTER };

    if (field === "seller_carnet") {
        match.carnet_vendedor = regex;
    } else if (field === "phone") {
        match.$and = [
            {
                $or: [
                    { telefono_vendedor: regex },
                    { telefono_comprador: regex }
                ]
            }
        ];
    } else {
        match.$and = [
            {
                $or: [
                    { vendedor: regex },
                    { comprador: regex }
                ]
            }
        ];
    }

    const rows = await VentaExternaModel.find(match)
        .select("carnet_vendedor vendedor telefono_vendedor comprador telefono_comprador fecha_pedido hora_entrega_real")
        .sort({ hora_entrega_real: -1, fecha_pedido: -1 })
        .limit(300)
        .lean();

    const suggestions = new Map<string, ExternalContactSuggestion>();
    const addSuggestion = (suggestion: ExternalContactSuggestion) => {
        const key = [
            String(suggestion.carnet_vendedor || "").trim().toLowerCase(),
            String(suggestion.nombre || "").trim().toLowerCase(),
            String(suggestion.telefono || "").trim().toLowerCase()
        ].join("|");

        if (!suggestion.nombre && !suggestion.telefono && !suggestion.carnet_vendedor) return;
        if (!suggestions.has(key)) suggestions.set(key, suggestion);
    };

    rows.forEach((row: any) => {
        const lastUsed = row.hora_entrega_real || row.fecha_pedido;
        const sellerSuggestion = {
            carnet_vendedor: row.carnet_vendedor,
            nombre: row.vendedor,
            telefono: row.telefono_vendedor,
            source: "seller" as const,
            lastUsed
        };
        const buyerSuggestion = {
            nombre: row.comprador,
            telefono: row.telefono_comprador,
            source: "buyer" as const,
            lastUsed
        };

        if (field === "seller_carnet") {
            if (regex.test(String(row.carnet_vendedor || ""))) addSuggestion(sellerSuggestion);
            return;
        }

        if (field === "phone") {
            if (regex.test(String(row.telefono_vendedor || ""))) addSuggestion(sellerSuggestion);
            if (regex.test(String(row.telefono_comprador || ""))) addSuggestion(buyerSuggestion);
            return;
        }

        if (regex.test(String(row.vendedor || ""))) addSuggestion(sellerSuggestion);
        if (regex.test(String(row.comprador || ""))) addSuggestion(buyerSuggestion);
    });

    return Array.from(suggestions.values()).slice(0, safeLimit);
}

const getExternalSaleByID = async (id: string): Promise<IVentaExternaDocument | null> => {
    if (!Types.ObjectId.isValid(id)) return null;
    return await VentaExternaModel.findOne({
        _id: new Types.ObjectId(id),
        ...EXTERNAL_SERVICE_FILTER
    })
        .populate('sucursal')
        .populate({ path: "origen_sucursal", select: "_id nombre" })
        .populate({ path: "destino_sucursal", select: "_id nombre" });
}

const getExternalSalesByDateRange = async (
    from?: Date,
    to?: Date,
    sucursalIds?: string[]
): Promise<IVentaExternaDocument[]> => {
    const validSucursalIds = (sucursalIds || []).filter((id) => Types.ObjectId.isValid(id));
    if (!from && !to && !validSucursalIds.length) return await getAllExternalSales();

    const match: any = { ...EXTERNAL_SERVICE_FILTER };
    if (from || to) {
        match.fecha_pedido = {};
        if (from) match.fecha_pedido.$gte = from;
        if (to) match.fecha_pedido.$lte = to;
    }
    if (validSucursalIds.length) {
        match.sucursal = {
            $in: validSucursalIds.map((id) => new Types.ObjectId(id))
        };
    }

    return await VentaExternaModel.find(match)
        .populate('sucursal')
        .populate({ path: "origen_sucursal", select: "_id nombre" })
        .populate({ path: "destino_sucursal", select: "_id nombre" });
}

const getExternalSalesHistoryCandidates = async (
    from?: Date,
    to?: Date,
    sucursalIds?: string[]
): Promise<IVentaExternaDocument[]> => {
    const validSucursalIds = (sucursalIds || []).filter((id) => Types.ObjectId.isValid(id));
    const match: any = { $and: [EXTERNAL_SERVICE_FILTER] };

    if (validSucursalIds.length) {
        const branchObjectIds = validSucursalIds.map((id) => new Types.ObjectId(id));
        match.$and.push({
            $or: [
                { sucursal: { $in: branchObjectIds } },
                { destino_sucursal: { $in: branchObjectIds } }
            ]
        });
    }

    if (from || to) {
        const fechaPedidoRange: any = {};
        const horaEntregaRange: any = {};
        if (from) {
            fechaPedidoRange.$gte = from;
            horaEntregaRange.$gte = from;
        }
        if (to) {
            fechaPedidoRange.$lte = to;
            horaEntregaRange.$lte = to;
        }

        match.$and.push({
          $or: [
            { fecha_pedido: fechaPedidoRange },
            { hora_entrega_real: horaEntregaRange }
          ]
        });
    }

    return await VentaExternaModel.find(match)
        .sort({ hora_entrega_real: -1, fecha_pedido: -1 })
        .populate('sucursal')
        .populate({ path: "origen_sucursal", select: "_id nombre" })
        .populate({ path: "destino_sucursal", select: "_id nombre" });
}

const registerExternalSale = async (externalSale: IVentaExterna): Promise<IVentaExternaDocument> => {
    const newSale = new VentaExternaModel(externalSale);
    const saved = await newSale.save();

    return saved;
}

const registerExternalSales = async (externalSales: IVentaExterna[]): Promise<IVentaExternaDocument[]> => {
    if (!externalSales.length) return [];
    const created = await VentaExternaModel.insertMany(externalSales);
    const createdIds = created.map((row) => row._id);
    return await VentaExternaModel.find({ _id: { $in: createdIds } })
        .populate('sucursal')
        .populate({ path: "origen_sucursal", select: "_id nombre" })
        .populate({ path: "destino_sucursal", select: "_id nombre" });
}

const deleteExternalSaleByID = async (externalSaleID: string) => {
    if (!Types.ObjectId.isValid(externalSaleID)) return null;
    return await VentaExternaModel.findOneAndDelete({
        _id: new Types.ObjectId(externalSaleID),
        ...EXTERNAL_SERVICE_FILTER
    });
}

const updateExternalSaleByID = async (id: string, externalSale: IVentaExterna): Promise<IVentaExternaDocument | null> => {
    if (!Types.ObjectId.isValid(id)) return null;
    return await VentaExternaModel.findOneAndUpdate(
        {
            _id: new Types.ObjectId(id),
            ...EXTERNAL_SERVICE_FILTER
        },
        externalSale,
        { new: true }
    )
        .populate('sucursal')
        .populate({ path: "origen_sucursal", select: "_id nombre" })
        .populate({ path: "destino_sucursal", select: "_id nombre" });
}

export const ExternalSaleRepository = {
    getAllExternalSales,
    getExternalSalesList,
    getExternalContactSuggestions,
    getExternalSaleByID,
    getExternalSalesByDateRange,
    getExternalSalesHistoryCandidates,
    registerExternalSale,
    registerExternalSales,
    deleteExternalSaleByID,
    updateExternalSaleByID
};
