import AppDataSource from "../config/dataSource";
import { PedidoEntity } from "../entities/implements/PedidoEntity";
import { IPedido } from "../entities/IPedido";
import { Pedido } from "../models/Pedido";

const shippingRepository = AppDataSource.getRepository(PedidoEntity)

const findAll = async (): Promise<Pedido[]> => {
    return await shippingRepository.find()
}

const findById = async(shippingId: number) => {
    return await shippingRepository.findOne({
        where: {
            id_pedido: shippingId
        }
    })
}

const registerShipping = async (shipping: IPedido): Promise<Pedido> => {
    const newShipping = shippingRepository.create(shipping);
    const savedShipping = await shippingRepository.save(newShipping);
    return new Pedido(savedShipping);
}

export const ShippingRepository = {
    findAll,
    registerShipping,
    findById
}