
import { group } from "console";
import AppDataSource from "../config/dataSource";
import { IGroup } from "../entities/IGroup";
import { GroupEntity } from "../entities/implements/GroupSchema";
import { ProductoEntity } from "../entities/implements/ProductoSchema";
import { IProducto } from "../entities/IProducto";
import { Group } from "../models/Group";
import { Not } from "typeorm";

const productRepository = AppDataSource.getRepository(ProductoEntity)
const groupRepository = AppDataSource.getRepository(GroupEntity)

const getAllGroups = async () => {
    return await groupRepository.find({
        where: {
            name: Not("Sin Grupo")
        }
    });
}

const getAllGroupsWithProducts = async () => {
    return await groupRepository.find({
        where: {
            name: Not("Sin Grupo")
        },
        relations: {
            products: true
        }
    });
}

const getGroupById = async (id: number) => {
    return await groupRepository.findOne({
        where: {
            id
        }
    })
}

const getProductsInGroup = async (group: any) => {
    return await productRepository.find({
        where: {
            groupId: group.id
        },
        relations: {
            group: true,
            categoria: true,
            features: true,
            vendedor: true,
            producto_sucursal: true,
        }
    })
}

const registerGroup = async (group: IGroup) => {
    const newGroup: GroupEntity = groupRepository.create(group)
    const savedGroup: IGroup = await groupRepository.save(newGroup)
    return new Group(savedGroup)
}

const getExampleProduct = async (group: IGroup) => {
    return await productRepository.findOne({
        where: {
            groupId: group.id
        }
    })
}

const updateGroup = async (newData: any, groupId: IGroup) => {
    const updatedGroup = { ...groupId, ...newData }
    const newGroup = await groupRepository.save(updatedGroup)
    return newGroup
}

export const GroupRepository = {
    getProductsInGroup,
    getGroupById,
    registerGroup,
    getAllGroups,
    getExampleProduct,
    getAllGroupsWithProducts,
    updateGroup
}