import { ExternalSaleRepository } from "../repositories/external.repository";
import moment from 'moment-timezone';
import { ExternalPaidStatus, IVentaExterna } from "../entities/IVentaExterna";

const getAllExternalSales = async () => {
    return await ExternalSaleRepository.getAllExternalSales();
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
    return await ExternalSaleRepository.getExternalSalesList(params);
}

const getExternalSaleByID = async (id: string) => {
    return await ExternalSaleRepository.getExternalSaleByID(id);
}

const normalizePaidStatus = (value: unknown): ExternalPaidStatus => {
    if (value === true || value === "si" || value === "SI" || value === "Sí") return "si";
    return "no";
};

const normalizeOrderStatus = (value: unknown, delivered: boolean): string => {
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }
    return delivered ? "Entregado" : "En Espera";
};

const normalizeExternalDate = (value: unknown) => {
    if (value) {
        return moment.tz(value as string, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
    }
    return moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
};

const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const buildExternalRecord = (input: any, index = 0): IVentaExterna => {
    const paid = normalizePaidStatus(input.esta_pagado);
    const packagePrice = toNumber(input.precio_paquete ?? input.precio_total, 0);
    const initialDelivered = input.delivered === true || input.estado_pedido === "Entregado";
    const estadoPedido = normalizeOrderStatus(input.estado_pedido, initialDelivered);
    const delivered = estadoPedido === "Entregado";

    return {
        carnet_vendedor: String(input.carnet_vendedor ?? input.carnet ?? "SN"),
        vendedor: String(input.vendedor ?? input.nombre_vendedor ?? "Externo"),
        telefono_vendedor: String(input.telefono_vendedor ?? ""),
        numero_paquete: toNumber(input.numero_paquete, index + 1),
        comprador: String(input.comprador ?? input.nombre_comprador ?? "Sin comprador"),
        descripcion_paquete: String(input.descripcion_paquete ?? input.descripcion ?? "Sin descripcion"),
        telefono_comprador: String(input.telefono_comprador ?? ""),
        fecha_pedido: normalizeExternalDate(input.fecha_pedido) as unknown as Date,
        sucursal: input.sucursal ?? input.id_sucursal,
        precio_paquete: packagePrice,
        precio_total: packagePrice,
        esta_pagado: paid,
        saldo_cobrar: paid === "si" ? 0 : packagePrice,
        estado_pedido: estadoPedido,
        delivered,
        is_external: true,
        hora_entrega_real: delivered
            ? (normalizeExternalDate(input.hora_entrega_real ?? input.fecha_pedido) as unknown as Date)
            : undefined,
        lugar_entrega: String(input.lugar_entrega ?? "Externo"),
        direccion_delivery: input.direccion_delivery,
        ciudad_envio: input.ciudad_envio,
        nombre_flota: input.nombre_flota,
        precio_servicio: toNumber(input.precio_servicio, 0),
    };
};

const registerExternalSale = async (externalSale: any) => {
    if (Array.isArray(externalSale?.paquetes) && externalSale.paquetes.length > 0) {
        const created = await registerExternalSalesByPackages(externalSale);
        return created[0];
    }

    if (externalSale.id_sucursal) {
        externalSale.sucursal = externalSale.id_sucursal;
    }

    const record = buildExternalRecord(externalSale);
    return await ExternalSaleRepository.registerExternalSale(record);
}

const registerExternalSalesByPackages = async (payload: any) => {
    const paquetes = Array.isArray(payload?.paquetes) ? payload.paquetes : [];
    if (!paquetes.length) {
        throw new Error("Debe enviar al menos un paquete");
    }

    const toCreate: IVentaExterna[] = paquetes.map((pkg: any, index: number) => {
        const merged = {
            ...payload,
            ...pkg,
            numero_paquete: pkg?.numero_paquete ?? index + 1,
            fecha_pedido: payload?.fecha_pedido,
            carnet_vendedor: payload?.carnet_vendedor,
            vendedor: payload?.vendedor,
            telefono_vendedor: payload?.telefono_vendedor,
        };

        if (merged.id_sucursal) {
            merged.sucursal = merged.id_sucursal;
        }

        return buildExternalRecord(merged, index);
    });

    return await ExternalSaleRepository.registerExternalSales(toCreate);
}

const deleteExternalSaleByID = async (id: string) => {
    return await ExternalSaleRepository.deleteExternalSaleByID(id);
}

const updateExternalSaleByID = async (id: string, externalSale: any) => {
    const existing = await ExternalSaleRepository.getExternalSaleByID(id);
    if (!existing) return null;

    const price = toNumber(
        externalSale.precio_paquete ?? existing.precio_paquete ?? externalSale.precio_total ?? existing.precio_total,
        0
    );
    const paid = normalizePaidStatus(externalSale.esta_pagado ?? existing.esta_pagado);
    const status = normalizeOrderStatus(
        externalSale.estado_pedido ?? existing.estado_pedido,
        externalSale.delivered === true || existing.delivered === true
    );
    const delivered = status === "Entregado";

    const updatePayload: any = {
        ...externalSale,
        precio_paquete: price,
        precio_total: price,
        esta_pagado: paid,
        saldo_cobrar: paid === "si" ? 0 : price,
        estado_pedido: status,
        delivered,
        is_external: true,
    };

    if (externalSale.fecha_pedido) {
        updatePayload.fecha_pedido = normalizeExternalDate(externalSale.fecha_pedido);
    }

    if (delivered && !externalSale.hora_entrega_real) {
        updatePayload.hora_entrega_real = normalizeExternalDate(existing.hora_entrega_real ?? existing.fecha_pedido);
    } else if (!delivered) {
        updatePayload.hora_entrega_real = undefined;
    }

    if (externalSale.id_sucursal) {
        updatePayload.sucursal = externalSale.id_sucursal;
    }

    return await ExternalSaleRepository.updateExternalSaleByID(id, updatePayload);
}

export const ExternalSaleService = {
    getAllExternalSales,
    getExternalSalesList,
    getExternalSaleByID,
    registerExternalSale,
    registerExternalSalesByPackages,
    deleteExternalSaleByID,
    updateExternalSaleByID
}
