import { IGroup } from "../entities/IGroup"
import { GroupRepository } from "../repositories/group.repository"
import { ProductRepository } from "../repositories/product.repository"
import { ProductService } from "./product.service"



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


const updateGroupAndProductNames = async (newData: any, groupId: number) => {
    const group = await GroupRepository.getGroupById(groupId)
    if (!group) throw new Error(`Group with id ${groupId} doesn't exist`)
    const originalGroupName = group.name
    const updatedGroup = await GroupRepository.updateGroup(newData, group)
    const groupProducts = await getProductsByGroup(groupId)
    const newProductNames = groupProducts.map((product: any) => {
        let featureNames = ''
        if (product.features.length > 0) {
            featureNames = product.features.reduce((acc: string, feature: any) => `${acc} ${feature.value}`, ' ').trim()
        } else {
            featureNames = product.nombre_producto.replace(originalGroupName, '').trim()
        }
        return {
            id_producto: product.id_producto,
            nombre_producto: `${newData.name} ${featureNames}`
        }
    })
    let updatedProducts = []
    for (const newProductName of newProductNames) {
        const product: any = await ProductRepository.findById(newProductName.id_producto)
        const what = await ProductRepository.updateProduct(product, { nombre_producto: newProductName.nombre_producto })
        console.log(what, 'am i updating')
        updatedProducts.push(what)
    }
    return { group: updatedGroup, products: updatedProducts }
}

const getGroupById = async (idGroup: number) => {
    const group = await GroupRepository.getGroupById(idGroup)
    return group
}

export const GroupService = {
    getProductsByGroup,
    getAllGroups,
    getAllGroupsWithProducts,
    updateGroup,
    updateGroupAndProductNames,
    getGroupById
}