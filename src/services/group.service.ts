import { GroupRepository } from "../repositories/group.repository"
import { ProductRepository } from "../repositories/product.repository"



const getProductsByGroup = async (idGroup: number) => {
    const group = await GroupRepository.getGroupById(idGroup)
    if(!group)
        throw new Error("Group with such id doesn't exist")
    return await GroupRepository.getProductsInGroup(group)
}

export const GroupService = {
    getProductsByGroup
}