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
    console.log("Category controller:",category)
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
export const getCategoryById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // <- sacamos el id de los parámetros de la URL
        const category = await CategoryService.getCategoryById(id);
        res.json(category);
    } catch (error) {
        console.error(error);
        res.status(404).json({ error: 'Categoría no encontrada' });
    }
}
