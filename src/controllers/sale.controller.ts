import { Request, Response } from "express";
import { SaleService } from "../services/sale.service";

export const getSale = async (req: Request, res:Response) => {
    try {
        const sale = await SaleService.getAllSales();
        res.json(sale);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const registerSale = async(req: Request, res:Response) => {
    const sale = req.body;
    try {
        const newSale= await SaleService.registerSale(sale);
        res.json({
            status: true,
            newSale
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
export const getProducts = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id);
    try {
        const products = await SaleService.getProductsById(id);
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}