import { Request, Response } from "express";
import { SellerService } from "../services/seller.service";

export const getSellers = async (req: Request, res: Response) => {
    const sellers = await SellerService.getAllSellers();
    res.json(sellers)
}

export const registerSeller = async (req: Request, res: Response) => {
    const seller = req.body;
    try {    
        const newSeller = await SellerService.registerSeller(seller)  
        res.json({
            status: true,
            newSeller
        })
    } catch (error) {
        console.log(error)
    }
}