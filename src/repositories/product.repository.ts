import { Producto } from "../models/Producto";
import AppDataSource from '../config/dataSource';
import { ProductoEntity } from '../entities/implements/ProductoEntity';
import { IProducto } from "../entities/IProducto";
import { IVenta } from "../entities/IVenta";
import { VentaEntity } from "../entities/implements/VentaEntity";
import { Producto_SucursalEntity } from "../entities/implements/Producto_SucursalEntity";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";

const productRepository = AppDataSource.getRepository(ProductoEntity);
const productSucursalRepository = AppDataSource.getRepository(Producto_SucursalEntity)

const findAll = async (): Promise<ProductoEntity[]> => {
    return await productRepository.find({
        relations: {
            features: true,
            producto_sucursal: true
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

const registerProduct = async (product: IProducto): Promise<any> => {
    const newProduct = productRepository.create(product);
    const savedProduct = await productRepository.save(newProduct);
    return new Producto(savedProduct);
}

const getProductsBySales = async (sales: VentaEntity[]) => {
    const productIds = sales.map(sale => sale.producto.id_producto);
    //console.log(`Product IDs to fetch: ${productIds}`);
    
    // Usando los IDs de producto para buscar los productos correspondientes
    const products = await productRepository.findByIds(productIds);
    //console.log(`Products fetched: ${JSON.stringify(products)}`);

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

export const ProductRepository = {
    findAll,
    findById,
    registerProduct,
    getProductsBySales,
    getStockProduct,
    updateStock
};