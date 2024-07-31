import e, { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";
import { IGroup } from "../entities/IGroup";
import { GroupRepository } from "../repositories/group.repository";
import { GroupEntity } from "../entities/implements/GroupEntity";
import { IProducto } from "../entities/IProducto";
import { ProductBranchService } from "../services/productBranch.service";
export const getProduct = async (req: Request, res: Response) => {
    try {
        const products = await ProductService.getAllProducts();
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

const registerProduct = async (req: Request, res: Response) => {
    const {product, stock} = req.body;
    try {
        const newProduct = await ProductService.registerProduct(product);
        const newStock = await ProductBranchService.registerProductBranch({id_producto: newProduct.id_producto,...stock})
        res.json({
            status: true,
            newProduct,
            newStock
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getFeatures = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id)
    try {
        const features = await ProductService.getFeaturesById(id)
        res.json(features)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });

    }
}

export const addFeatureToProduct = async (req: Request, res: Response) => {
    const { productId, features } = req.body
    try {

        const saveFeatures = [] as any[]

        for (let feature of features) {
            const featureProduct = await ProductService.addFeatureToProduct(productId, feature)
            saveFeatures.push(featureProduct)
        }
        res.json(saveFeatures)
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });

    }
}

export const getProductCategory = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const product = await ProductService.getProductById(parseInt(id))
        const category = await CategoryService.getCategoryById(product.id_categoria)
        res.json(category)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Internal Server Error', error });

    }
}

export const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const product = await ProductService.getProductById(parseInt(id))
        res.json(product)
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'Internal Server Error', error });

    }
}

const registerProductVariants = async (req: Request, res: Response) => {
    const group = { name: req.body.group } as any
    const { variants, id_sucursal } = req.body

    const savedGroup = await GroupRepository.registerGroup(group)

    const products = [] as any[]

    for (let variant of variants) {
        const product = { ...variant, group: savedGroup } as IProducto
        const newProduct = await ProductService.registerProduct(product)
        const {cantidad_por_sucursal} = variant
        
        const newStock = await ProductBranchService.registerProductBranch({
            id_producto: newProduct.id_producto,
            id_sucursal,
            cantidad_por_sucursal})
        products.push({newProduct, newStock})

    }

    res.json({
        msg: "Succesfull",
        products
    })
}

export const addStockToBranch = async (req: Request, res: Response) => {
    const { branch, products } = req.body


    const savedStocks = []

    try {
        for (let product of products) {
            const newStock = await ProductBranchService.registerProductBranch({ id_sucursal: branch, ...product })
            savedStocks.push(newStock)
        }
        res.json({
            status: true,
            savedStocks
        })
    } catch (error) {
        res.status(500).json({ msg: 'Internal Server Error' })
    }
}

const getProductStock = async (req: Request, res: Response) => {
    const idProduct = parseInt(req.params.idProduct)
    const idSucursal = parseInt(req.params.idSucursal)
    try {
        const inventory = await ProductService.getProductStock(idProduct, idSucursal)   
        res.json({
            inventory
        })     
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'Internal Server Error' , error})
    }
}

const updateStock = async (req: Request, res: Response) => {
    const {newStock} = req.body
    try {
        const updatedStock = await ProductService.updateStock(newStock)
        res.json({updatedStock})
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'Internal Server Error' , error})        
    }
}

export const ProductController = {
    registerProductVariants,
    registerProduct,
    getProductStock,
    updateStock
}