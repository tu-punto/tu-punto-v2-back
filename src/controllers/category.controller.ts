import { Request, Response } from "express";
import { CategoryService } from "../services/category.service";

export const getCategory = async (req:Request, res:Response) => {
    try {
        const categories = await CategoryService.getAllCategories();
        res.json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const registerCategory = async (req: Request, res:Response) => {
    const category = req.body;
    try {
        const newCategory = await CategoryService.registerCategory(category);
        res.json({
            status: true,
            newCategory
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}