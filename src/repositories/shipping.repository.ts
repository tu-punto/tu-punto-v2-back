import { In } from "typeorm";
import AppDataSource from "../config/dataSource";
import { PedidoEntity } from "../entities/implements/PedidoSchema";
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

const findByIds = async (shippingIds: number[]): Promise<Pedido[]> => {
    return await shippingRepository.find({
        where: {
            id_pedido: In(shippingIds)
        }
    });
}

const registerShipping = async (shipping: IPedido): Promise<Pedido> => {
    const newShipping = shippingRepository.create(shipping);
    const savedShipping = await shippingRepository.save(newShipping);
    return new Pedido(savedShipping);
}

const updateShipping = async (newData: any, shipping: IPedido) => {
    shipping = {...shipping, ...newData}
    const newShipping = await shippingRepository.save(shipping)
    return newShipping
}

export const ShippingRepository = {
    findAll,
    registerShipping,
    findById,
    findByIds,
    updateShipping
}