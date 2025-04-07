import { Producto } from "../models/Producto";
import AppDataSource from '../config/dataSource';
import { ProductoEntity } from '../entities/implements/ProductoSchema';
import { IProducto } from "../entities/IProducto";
import { IVenta } from "../entities/IVenta";
import { VentaEntity } from "../entities/implements/VentaSchema";
import { Producto_SucursalEntity } from "../entities/implements/ProductoSucursalSchema";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";

const productRepository = AppDataSource.getRepository(ProductoEntity);
const productSucursalRepository = AppDataSource.getRepository(Producto_SucursalEntity)

const findAll = async (): Promise<ProductoEntity[]> => {
    return await productRepository.find({
        relations: {
            features: true,
            producto_sucursal: true,
            categoria: true,
            group: true
        }
    })
}

const findById = async (productoId: number): Promise<ProductoEntity | null> => {
    return await productRepository.findOne({
        where: {
            id_producto: productoId
        }
    })
}
const findBySellerId = async (sellerId: number): Promise<ProductoEntity[] | null> => {
    return await productRepository.find({
        where: {
            id_vendedor: sellerId
        },
        relations: {
            ingreso:true
        }
    })
}

const registerProduct = async (product: IProducto): Promise<Producto> => {
    const newProduct = productRepository.create(product);
    const savedProduct = await productRepository.save(newProduct);
    return new Producto(savedProduct);
}

const getProductsBySales = async (sales: VentaEntity[]) => {
    const productIds = sales.map(sale => sale.producto.id_producto);
    
    // Usando los IDs de producto para buscar los productos correspondientes
    const products = await productRepository.findByIds(productIds);

    return products;
}

const getStockProduct = async (idProduct: number, idSucursal: number = 3) => {
    const productSucursal = await productSucursalRepository.findOne({
        where: {
            id_producto: idProduct,
            id_sucursal: idSucursal
        }
    })
    return productSucursal
}

const updateStock = async (stock: IProducto_Sucursal, newData: any) => {
    stock = {...stock, ...newData}
    const newStock = await productSucursalRepository.save(stock)
    return newStock
}

const updateProduct = async (product: IProducto, newData: any) => {
    product = {...product, ...newData}
    const newProduct = await productRepository.save(product)
    return newProduct
}

export const ProductRepository = {
    findAll,
    findById,
    findBySellerId,
    registerProduct,
    getProductsBySales,
    getStockProduct,
    updateStock,
    updateProduct
};