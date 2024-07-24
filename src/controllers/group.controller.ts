import { Request, Response } from "express";
import { GroupService } from "../services/group.service";


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
        res.json(groups)
    } catch (error) {
        
    }
}

export const GroupController = {
    getProductsInGroup,
    getAllGroups
}