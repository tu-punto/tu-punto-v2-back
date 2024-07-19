import { Producto } from "../models/Producto";
import AppDataSource from '../config/dataSource';
import { ProductoEntity } from '../entities/implements/ProductoEntity';
import { IProducto } from "../entities/IProducto";

const productRepository = AppDataSource.getRepository(ProductoEntity);

const findAll = async (): Promise<Producto[]> => {
    return await productRepository.find()
}
const registerProduct = async (product: IProducto): Promise<Producto> => {
    const newProduct = productRepository.create(product);
    const savedProduct = await productRepository.save(newProduct);
    return new Producto(savedProduct);
}

export const ProductRepository = {
    findAll,
    registerProduct
};