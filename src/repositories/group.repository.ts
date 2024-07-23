
import { group } from "console";
import AppDataSource from "../config/dataSource";
import { IGroup } from "../entities/IGroup";
import { GroupEntity } from "../entities/implements/GroupEntity";
import { ProductoEntity } from "../entities/implements/ProductoEntity";
import { IProducto } from "../entities/IProducto";
import { Group } from "../models/Group";

const productRepository = AppDataSource.getRepository(ProductoEntity)
const groupRepository = AppDataSource.getRepository(GroupEntity)

const getGroupById = async (id: number) => {
    return await groupRepository.findOne({
        where: {
            id
        }
    })
}

const getProductsInGroup = async (group: any) => {
    console.log(group)
    return await productRepository.find({
        where: {
            groupId: group.id
        },
        relations: {
            group: true
        }
    })
}

const registerGroup = async (group: IGroup) => {
    const newGroup: GroupEntity = groupRepository.create(group)
    const savedGroup: IGroup = await groupRepository.save(newGroup)
    return new Group(savedGroup)
}

export const GroupRepository = {
    getProductsInGroup,
    getGroupById,
    registerGroup
}