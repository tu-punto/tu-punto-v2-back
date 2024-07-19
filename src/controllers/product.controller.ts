import e, { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";
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

export const getFeatures = async (req: Request, res: Response) => {
    const id:number = parseInt(req.params.id)
    try{
        const features = await ProductService.getFeaturesById(id)
        res.json(features)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
        
    }
}

export const addFeatureToProduct = async (req: Request, res: Response) => {
    const {productId, featureId, value} = req.body
    try {
        const featureProduct = await ProductService.addFeatureToProduct(productId, featureId, value)
        res.json(featureProduct)
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
               
    }
}

export const getProductCategory = async (req: Request, res: Response) => {
    const {id} = req.params
    try{
        const product = await ProductService.getProductById(parseInt(id))
        const category = await CategoryService.getCategoryById(product.id_Categoria)
        res.json(category)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
        
    }
}