import { IGroup } from "../entities/IGroup"
import { GroupRepository } from "../repositories/group.repository"
import { ProductRepository } from "../repositories/product.repository"



const getProductsByGroup = async (idGroup: number) => {
    const group = await GroupRepository.getGroupById(idGroup)
    if (!group)
        throw new Error("Group with such id doesn't exist")
    return await GroupRepository.getProductsInGroup(group)
}

const getAllGroups = async () => {
    const groups = await GroupRepository.getAllGroupsWithProducts();
    const resGroups = groups.map((group) => {
        return { ...group, products: group.products.slice(0, 1) }
    })
    return resGroups
}

const getAllGroupsWithProducts = async () => {
    return await GroupRepository.getAllGroupsWithProducts()
}

const updateGroup = async (newData: any, groupId: number) => {
    const group = await GroupRepository.getGroupById(groupId)
    if (!group) throw new Error(`Group with id ${groupId} doesn't exist`)
    return await GroupRepository.updateGroup(newData, group)
}


export const GroupService = {
    getProductsByGroup,
    getAllGroups,
    getAllGroupsWithProducts,
    updateGroup
}