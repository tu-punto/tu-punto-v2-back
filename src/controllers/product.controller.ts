import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
export const getProduct = async (req: Request, res: Response) =>{
    try {
        const products = await ProductService.getAllProducts();
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const registerProduct = async (req: Request, res: Response) => {
    const product = req.body;
    try {
        const newProduct = await ProductService.registerProduct(product);
        res.json({
            status: true,
            newProduct
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}