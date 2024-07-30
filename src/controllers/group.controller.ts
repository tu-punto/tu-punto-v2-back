import { Request, Response } from "express";
import { GroupService } from "../services/group.service";
import { ProductService } from "../services/product.service";


const getProductsInGroup = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id)
    try {
        const products = await GroupService.getProductsByGroup(id)
        res.json(products)
    } catch (error) {
        console.log(error)
        throw res.status(500).json(error)
    }
}

const getAllGroups = async (req: Request, res: Response) => {
    try {
        const groups = await GroupService.getAllGroups()
        const products = await ProductService.getAllProducts()
        const resGroup = groups.map((group) => ({...group, features: [] as any[]}))
        for(let product of products) {
            const refFeature = resGroup.find(group => group.id === product.groupId)
            for(let feature of product.features){
                refFeature?.features.push(feature.feature)
            }
        }
        for(let group of resGroup){
            group.features = [...new Set(group.features)];
        }
        res.json(resGroup)
    } catch (error) {
        
    }
}

export const GroupController = {
    getProductsInGroup,
    getAllGroups
}