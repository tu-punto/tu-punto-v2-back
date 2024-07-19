import { SaleRepository } from "../repositories/sale.repository";

const getAllSales = async () => {
    return await SaleRepository.findAll();
};

const registerSale = async (sale:any) => {
    return await SaleRepository.registerSale(sale);
}

export const SaleService = {
    getAllSales,
    registerSale
}