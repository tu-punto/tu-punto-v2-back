import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";
import { IProducto } from "../entities/IProducto";
import { ProductBranchService } from "../services/productBranch.service";
import { GroupRepository } from "../repositories/group.repository";

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
    const { product } = req.body;
    console.log("Controller, product:",product);
    try {
        const newProduct = await ProductService.registerProduct(product);
        res.status(201).json({
            success: true,
            message: "Producto registrado correctamente",
            newProduct,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getFeatures = async (req: Request, res: Response) => {
    const id: string = req.params.id;
    try {
        const features = await ProductService.getFeaturesById(id);
        res.json(features);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const addFeatureToProduct = async (req: Request, res: Response) => {
    const { productId, features } = req.body;
    try {
        const saveFeatures = [];
        for (let feature of features) {
            const featureProduct = await ProductService.addFeatureToProduct(productId, feature);
            saveFeatures.push(featureProduct);
        }
        res.json(saveFeatures);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}

export const getProductCategory = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const product = await ProductService.getProductById(id);
        const category = await CategoryService.getCategoryById(product.id_categoria);
        res.json(category);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}

export const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const product = await ProductService.getProductById(id);
        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}

export const getAllProductsEntryAmountBySellerId = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const stock = await ProductService.getAllProductsEntryAmountBySellerId(id);
        res.json(stock);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error getting entry amount by a seller Id', error });
    }
}

const registerProductVariants = async (req: Request, res: Response) => {
    const group = { name: req.body.group };
    const { variants, id_sucursal } = req.body;

    try {
        const savedGroup = await GroupRepository.registerGroup(group);
        const products = [];

        for (let variant of variants) {
            const product: IProducto = { ...variant, group: savedGroup };
            const newProduct = await ProductService.registerProduct(product);
            const { cantidad_por_sucursal } = variant;

            const newStock = await ProductBranchService.registerProductBranch({
                id_producto: newProduct._id,
                id_sucursal,
                cantidad_por_sucursal
            });
            products.push({ newProduct, newStock });
        }

        res.json({ msg: "Successful", products });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}

export const addStockToBranch = async (req: Request, res: Response) => {
    const { branch, products } = req.body;
    const savedStocks = [];

    try {
        for (let product of products) {
            const newStock = await ProductBranchService.registerProductBranch({ id_sucursal: branch, ...product });
            savedStocks.push(newStock);
        }
        res.json({ status: true, savedStocks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error' });
    }
}

const getProductStock = async (req: Request, res: Response) => {
    const { idProduct, idSucursal } = req.params;
    try {
        const inventory = await ProductService.getProductStock(idProduct, idSucursal);
        res.json({ inventory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}
/*
const updateStock = async (req: Request, res: Response) => {
    const { newStock } = req.body;
    try {
        const updatedStock = await ProductService.updateStock(newStock);
        res.json({ updatedStock });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}
    */

const getAllStockByProductId = async (req: Request, res: Response) => {
    const { idProduct } = req.params;
    try {
        const stocks = await ProductService.getAllStockByProductId(idProduct);
        res.json(stocks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Internal Server Error', error });
    }
}

const updateProductBranchStock = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nuevaCantidad } = req.body;

    try {
        const updatedProductBranch = await ProductBranchService.updateCantidadPorSucursal(id, nuevaCantidad);
        if (!updatedProductBranch) {
            return res.status(404).json({ msg: 'Producto sucursal no encontrado' });
        }

        res.json({
            status: true,
            msg: 'Cantidad actualizada correctamente',
            updatedProductBranch
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error actualizando la cantidad del producto sucursal', error });
    }
};
export const addVariantToSucursal = async (req: Request, res: Response) => {
  const { productId, sucursalId, variant } = req.body;

  try {
    const updatedProduct = await ProductService.addVariantToSucursal(productId, sucursalId, variant);
    res.json({
      status: true,
      msg: 'Variante agregada correctamente',
      updatedProduct
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, msg: 'Error agregando variante', error });
  }
};
export const updatePrice = async (req: Request, res: Response) => {
    const { priceUpdates } = req.body;
    console.log("Controller, priceUpdates:", priceUpdates);

    try {
        const updated = await ProductService.updatePrice(priceUpdates);
        res.json({ success: true, message: 'Precio actualizado correctamente', updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error actualizando el precio', error });
    }
};
export const updateSubvariantStock = async (req: Request, res: Response) => {
  const { productId, sucursalId, varianteNombre, subvarianteNombre, stock } = req.body;
  try {
    const updated = await ProductService.updateSubvariantStock({ productId, sucursalId, varianteNombre, subvarianteNombre, stock });
    res.json({ success: true, updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error actualizando stock de subvariante', error });
  }
};





export const ProductController = {
    getProduct,
    registerProduct,
    getFeatures,
    addFeatureToProduct,
    getProductCategory,
    getProductById,
    getAllProductsEntryAmountBySellerId,
    registerProductVariants,
    addStockToBranch,
    getProductStock,
    //updateStock,
    getAllStockByProductId,
    updateProductBranchStock,
    addVariantToSucursal,
    updatePrice,
    updateSubvariantStock
}
