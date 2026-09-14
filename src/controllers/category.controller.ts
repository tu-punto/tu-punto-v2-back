import { Request, Response } from "express";
import { CategoryService } from "../services/category.service";
import { uploadFileToAws } from "../services/bucket.service";
import { extname } from "path";

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

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const updates: { categoria?: string; imagen_catalogo_url?: string } = {};
    const name = String(req.body?.categoria || "").trim();
    if (name) updates.categoria = name;
    if (req.file) {
      const extension = extname(req.file.originalname).toLowerCase() || ".webp";
      updates.imagen_catalogo_url = await uploadFileToAws(
        req.file.buffer,
        `catalog/categories/${req.params.id}-${Date.now()}${extension}`,
        req.file.mimetype,
      );
    }
    if (!Object.keys(updates).length) return res.status(400).json({ status: false, msg: "Indica un nombre o una imagen" });
    const updatedCategory = await CategoryService.updateCategory(req.params.id, updates);
    res.json({ status: true, updatedCategory });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ status: false, msg: error?.message || "No se pudo actualizar la categoria" });
  }
};
