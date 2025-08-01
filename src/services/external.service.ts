import { ExternalSaleRepository } from "../repositories/external.repository";
import moment from 'moment-timezone';

const getAllExternalSales = async () => {
    return await ExternalSaleRepository.getAllExternalSales();
}

const registerExternalSale = async (externalSale: any) => {
    if (externalSale.fecha_pedido) {
        externalSale.fecha_pedido = moment.tz(externalSale.fecha_pedido, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss"); 
    }
    if (!externalSale.fecha_pedido) {
        externalSale.fecha_pedido = moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
    }

    if (externalSale.id_sucursal) {
        externalSale.sucursal = externalSale.id_sucursal
    }

    return await ExternalSaleRepository.registerExternalSale(externalSale);
}

const deleteExternalSaleByID = async (id: string) => {
    return await ExternalSaleRepository.deleteExternalSaleByID(id);
}

export const ExternalSaleService = {
    getAllExternalSales,
    registerExternalSale,
    deleteExternalSaleByID,
}