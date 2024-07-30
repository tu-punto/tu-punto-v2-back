import AppDataSource from "../config/dataSource";
import { VentaEntity } from "../entities/implements/VentaEntity";
import { IVenta } from "../entities/IVenta";
import { Venta } from "../models/Venta";

const saleRepository = AppDataSource.getRepository(VentaEntity)

const findAll = async (): Promise<Venta[]> => {
    return await saleRepository.find()
}

const registerSale = async (sale: IVenta): Promise<Venta> => {
    const newSale = saleRepository.create(sale);
    const savedSale = await saleRepository.save(newSale);
    return new Venta(savedSale);
}
const findByPedidoId = async (pedidoId: number): Promise<VentaEntity[]> => {
    console.log(`Searching for sales with pedidoId: ${pedidoId}`);
    const sales = await saleRepository.find({
        where: { pedido: { id_pedido: pedidoId } },
        relations: ['producto']
    });
    console.log(`Sales found: ${JSON.stringify(sales)}`);
    return sales;
}

export const SaleRepository = {
    findAll,
    registerSale,
    findByPedidoId
}