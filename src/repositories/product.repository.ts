import { Producto } from "../models/Producto";
import AppDataSource from '../config/dataSource';
import { ProductoEntity } from '../entities/implements/ProductoEntity';
import { IProducto } from "../entities/IProducto";
import { ICaracteristicas } from "../entities/ICaracteristicas";
import { Caracteristicas_Producto } from "../models/Caracteristicas_Producto";

const productRepository = AppDataSource.getRepository(ProductoEntity);

const findAll = async (): Promise<ProductoEntity[]> => {
    return await productRepository.find()
}

const findById = async (productoId: number): Promise<ProductoEntity | null> => {
    return await productRepository.findOne({
        where: {
            id_producto: productoId
        }
    })
}

const registerProduct = async (product: IProducto): Promise<any> => {
    const newProduct = productRepository.create(product);
    const savedProduct = await productRepository.save(newProduct);
    return new Producto(savedProduct);
}



export const ProductRepository = {
    findAll,
    findById,
    registerProduct
};