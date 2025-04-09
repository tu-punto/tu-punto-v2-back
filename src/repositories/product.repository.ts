import { ProductoModel } from '../entities/implements/ProductoSchema';
import { ProductoSucursalModel } from '../entities/implements/ProductoSucursalSchema';
import { IProducto } from '../entities/IProducto';
import { IVentaDocument } from '../entities/documents/IVentaDocument';
import { IProducto_Sucursal } from '../entities/IProducto_Sucursal';
import { IProductoDocument } from '../entities/documents/IProductoDocument';

const findAll = async (): Promise<IProductoDocument[]> => {
  return await ProductoModel.find()
    .populate('features')
    .populate('producto_sucursal')
    .populate('categoria')
    .populate('group')
    .exec();
}

const findById = async (productoId: number): Promise<IProductoDocument | null> => {
  return await ProductoModel.findOne({ id_producto: productoId }).exec();
}

const findBySellerId = async (sellerId: number): Promise<IProductoDocument[]> => {
  return await ProductoModel.find({ id_vendedor: sellerId })
    .populate('ingreso')
    .exec();
}

const registerProduct = async (product: IProducto): Promise<IProductoDocument> => {
  const newProduct = new ProductoModel(product);
  return await newProduct.save();
}

const getProductsBySales = async (sales: IVentaDocument[]) => {
  const productIds = sales.map(sale => sale.producto);
  return await ProductoModel.find({ _id: { $in: productIds } }).exec();
}

const getStockProduct = async (idProduct: number, idSucursal: number = 3): Promise<IProducto_Sucursal | null> => {
  return await ProductoSucursalModel.findOne({
    id_producto: idProduct,
    id_sucursal: idSucursal
  }).exec();
}

const updateStock = async (stock: IProducto_Sucursal, newData: any): Promise<IProducto_Sucursal> => {
    
    const existingStock = await ProductoSucursalModel.findOne({ _id: stock._id });
  
    if (existingStock) {
      
      Object.assign(existingStock, newData);
      await existingStock.save();
      return existingStock;
    } else {
      throw new Error("Stock no encontrado");
    }
  }
  

  const updateProduct = async (product: IProducto, newData: any): Promise<IProductoDocument> => {
    const existingProduct = await ProductoModel.findOne({ _id: product._id });
  
    if (existingProduct) {
      Object.assign(existingProduct, newData);
      await existingProduct.save();
      return existingProduct;
    } else {
      throw new Error("Producto no encontrado");
    }
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
