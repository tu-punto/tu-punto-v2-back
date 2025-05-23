import { ProductoModel } from '../entities/implements/ProductoSchema';
import { IVentaDocument } from '../entities/documents/IVentaDocument';
import { IProducto } from '../entities/IProducto';
import { IProductoDocument } from '../entities/documents/IProductoDocument';
import { Types } from 'mongoose';

const findAll = async (): Promise<IProductoDocument[]> => {
  return await ProductoModel.find()
    .populate('features')
    .populate('categoria')
    .populate('group')
    .exec();
};

const findById = async (productoId: string): Promise<IProductoDocument | null> => {
  return await ProductoModel.findById(productoId).exec();
};

const findBySellerId = async (sellerId: string): Promise<IProductoDocument[]> => {
  return await ProductoModel.find({ id_vendedor: sellerId }).populate('ingreso').exec();
};

const registerProduct = async (product: IProducto): Promise<IProductoDocument> => {
  const newProduct = new ProductoModel(product);
  return await newProduct.save();
};

const getProductsBySales = async (sales: IVentaDocument[]) => {
  const productIds = sales.map(sale => sale.producto);
  return await ProductoModel.find({ _id: { $in: productIds } }).exec();
};

const getStockForSucursal = async (productId: string, sucursalId: string) => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) return null;
  return producto.sucursales.find(s => s.id_sucursal.equals(sucursalId)) || null;
};

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

  // Recorremos las combinaciones para encontrar una que tenga esa variante
  const combinacion = sucursal.combinaciones?.find(c => c.variantes?.[varianteNombre] !== undefined);
  if (!combinacion) throw new Error("No se encontró una combinación con esa variante");

  combinacion.stock = nuevoStock;
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

  const combinacion = sucursal.combinaciones?.find(c => c.variantes?.[varianteNombre] !== undefined);
  if (!combinacion) throw new Error("No se encontró una combinación con esa variante");

  combinacion.precio = nuevoPrecio;
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

  const combinacion = sucursal.combinaciones?.find(c =>
    c.variantes?.[varianteNombre] === subvarianteNombre
  );

  if (!combinacion) throw new Error("No se encontró la combinación para esa subvariante");

  combinacion.stock = nuevoStock;
  return await producto.save();
};

const getAllStockByProductId = async (productId: string) => {
  return await ProductoModel.findById(productId).select('sucursales');
};

export const ProductRepository = {
  findAll,
  findById,
  findBySellerId,
  registerProduct,
  getProductsBySales,
  updateProduct: async (productId: string, data: Partial<IProducto>) =>
    await ProductoModel.findByIdAndUpdate(productId, data, { new: true }).exec(),
  getStockForSucursal,
  updateStockInSucursal,
  getAllStockByProductId,
  updatePriceInSucursal,
  updateStockOfSubvariant
};
