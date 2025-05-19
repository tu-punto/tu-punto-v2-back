import { ProductoModel } from '../entities/implements/ProductoSchema';
import { ProductoSucursalModel } from '../entities/implements/ProductoSucursalSchema';
import { IProducto } from '../entities/IProducto';
import { IVentaDocument } from '../entities/documents/IVentaDocument';
import { IProducto_Sucursal } from '../entities/IProducto_Sucursal';
import { IProductoDocument } from '../entities/documents/IProductoDocument';
import { Types } from 'mongoose';
const findAll = async (): Promise<IProductoDocument[]> => {
  return await ProductoModel.find()
    .populate('features')
    .populate('categoria')
    .populate('group')
    .exec();
}

const findById = async (productoId: string): Promise<IProductoDocument | null> => {
  return await ProductoModel.findById(productoId).exec();
}

const findBySellerId = async (sellerId: string): Promise<IProductoDocument[]> => {
  return await ProductoModel.find({ id_vendedor: sellerId }).populate('ingreso').exec();
}


const registerProduct = async (product: any): Promise<IProductoDocument> => {
  console.log("Repository, product:",product);
  console.log("Depurar:",JSON.stringify(product, null, 2));

  console.log("Repository, product:",product);
    
  const newProduct = new ProductoModel(product);
  console.log("Repository, nuevoproduct:",newProduct);
  return await newProduct.save();
}

const getProductsBySales = async (sales: IVentaDocument[]) => {
  const productIds = sales.map(sale => sale.producto);
  return await ProductoModel.find({ _id: { $in: productIds } }).exec();
}
const getStockForSucursal = async (productId: string, sucursalId: string) => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) return null;

  return producto.sucursales.find(s => s.id_sucursal.equals(sucursalId)) || null;
}
const updateStockInSucursal = async (
  productId: string,
  sucursalId: string,
  varianteNombre: string,
  nuevoStock: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  const variante = sucursal.variantes.find(v => v.nombre_variante === varianteNombre);
  if (!variante) throw new Error("Variante no encontrada");

  variante.stock = nuevoStock;
  return await producto.save();
}

  

  const updateProduct = async (productId: string, newData: Partial<IProducto>): Promise<IProductoDocument | null> => {
    return await ProductoModel.findByIdAndUpdate(productId, newData, { new: true }).exec();
  }
  const getAllStockByProductId = async (productId: string) => {
    return await ProductoModel.findById(productId).select('stockPorSucursal'); // o lo que corresponda
  };
  const addVariantToSucursal = async (
  productId: string,
  sucursalId: string,
  variant: {
    nombre_variante: string;
    precio?: number;
    stock?: number;
    subvariantes?: { nombre_subvariante: string; precio: number; stock: number }[];
  }
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s =>
    s.id_sucursal.equals(new Types.ObjectId(sucursalId))
  );
  if (!sucursal) throw new Error("Sucursal no encontrada");

  const existe = sucursal.variantes.some(
    v => v.nombre_variante === variant.nombre_variante
  );
  if (existe) throw new Error("Ya existe una variante con ese nombre en esta sucursal");

  sucursal.variantes.push(variant);
  return await producto.save();
};


const updatePriceInSucursal = async (
  productId: string,
  sucursalId: string,
  varianteNombre: string,
  nuevoPrecio: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  const variante = sucursal.variantes.find(v => v.nombre_variante === varianteNombre);
  if (!variante) throw new Error("Variante no encontrada");

  variante.precio = nuevoPrecio;
  return await producto.save();
};
const updateStockOfSubvariant = async (
  productId: string,
  sucursalId: string,
  varianteNombre: string,
  subvarianteNombre: string,
  nuevoStock: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  const variante = sucursal.variantes.find(v => v.nombre_variante === varianteNombre);
  if (!variante) throw new Error("Variante no encontrada");

  const subvariante = variante.subvariantes?.find(sv => sv.nombre_subvariante === subvarianteNombre);
  if (!subvariante) throw new Error("Subvariante no encontrada");

  subvariante.stock = nuevoStock;
  return await producto.save();
};


  export const ProductRepository = {
    findAll,
    findById,
    findBySellerId,
    registerProduct,
    getProductsBySales,
    updateProduct,
    getStockForSucursal,      
    updateStockInSucursal,
    getAllStockByProductId,
    addVariantToSucursal,
    updatePriceInSucursal,
    updateStockOfSubvariant    
  };
  
