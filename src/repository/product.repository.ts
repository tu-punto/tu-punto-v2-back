import { Producto } from "../models/Producto";
import AppDataSource from '../config/dataSource';
import { ProductoEntity } from '../entities/implements/ProductoEntity';
import { IProducto } from "../entities/IProducto";
import { Caracteristicas_ProductoEntity } from "../entities/implements/Caracteristicas_ProductoEntity";
import { Caracteristicas } from "../models/Caracteristicas";
import { ICaracteristicas } from "../entities/ICaracteristicas";
import { Caracteristicas_Producto } from "../models/Caracteristicas_Producto";

const productRepository = AppDataSource.getRepository(ProductoEntity);
const productoCaracteristicaRepository = AppDataSource.getRepository(Caracteristicas_ProductoEntity)


const findAll = async (): Promise<ProductoEntity[]> => {
    return await productRepository.find()
}

const findById = async (productoId: number): Promise<ProductoEntity | null> => {
    return await productRepository.findOne({
        where: {
            id_Producto: productoId
        }
    })
}

const registerProduct = async (product: IProducto): Promise<any> => {
    const newProduct = productRepository.create(product);
    const savedProduct = await productRepository.save(newProduct);
    return new Producto(savedProduct);
}

const getFeatures = async (product: any): Promise<any> => {
    const features = await productoCaracteristicaRepository.find({
        relations:{
          caracteristica: true,
          producto: true
        }
      })
    return features
}

const addFeatureToProduct = async (product: IProducto, feature: ICaracteristicas, value: string) => {
    const newRelation = productoCaracteristicaRepository.create({
        caracteristica: feature,
        producto: product,
        value
    })
    const savedRelation = await productoCaracteristicaRepository.save(newRelation)
    return new Caracteristicas_Producto(savedRelation)
}


export const ProductRepository = {
    findAll,
    findById,
    registerProduct,
    getFeatures,
    addFeatureToProduct
};