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
  variante: Record<string, string>,
  nuevoPrecio: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  console.log("🔍 Buscando combinación con variantes:", variante);
  console.log("📦 Combinaciones disponibles:");
  sucursal.combinaciones.forEach((c, i) => {
    console.log(`🧪 Combinación #${i + 1}:`, c.variantes);
  });

  const combinacion = sucursal.combinaciones.find(c => {
    const combKeys = Object.keys(c.variantes || {});
    const inputKeys = Object.keys(variante);

    if (combKeys.length !== inputKeys.length) {
      console.log(`❌ Diferente número de claves: combinacion (${combKeys.length}) vs entrada (${inputKeys.length})`);
      return false;
    }

    const isMatch = inputKeys.every(key =>
      c.variantes[key]?.toLowerCase?.() === variante[key]?.toLowerCase?.()
    );
    console.log(`❌ Diferente número de claves: combinacion (${combKeys}) vs entrada (${inputKeys})`);

    if (!isMatch) {
      console.log(`❌ No coincide: combinacion`, c.variantes, "vs entrada", variante);
    }

    return isMatch;
  });
  
  if (!combinacion) {
    console.error("❌ No se encontró la combinación correspondiente.");
    throw new Error("No se encontró una combinación con esa variante");
  }

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
const updateStockByVariantCombination = async (
  productId: string,
  sucursalId: string,
  variantes: Record<string, string>,
  nuevoStock: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  //console.log("🔍 Buscando combinación para variantes:", variantes);
  //console.log("📦 Combinaciones disponibles:", sucursal.combinaciones.map((c, i) => ({ index: i + 1, variantes: c.variantes })));
  const combinacion = sucursal.combinaciones.find((c, index) => {
  const variantesPlanas = Object.fromEntries(c.variantes instanceof Map ? c.variantes : Object.entries(c.variantes || {}));
  const combKeys = Object.keys(variantesPlanas);
  const inputKeys = Object.keys(variantes);

  //console.log(`\n🧪 Combinación #${index + 1}:`, variantesPlanas);
  //console.log(`📥 Entrada esperada:`, variantes);

  if (combKeys.length !== inputKeys.length) {
    //console.log(`❌ Diferente número de claves: combinacion (${combKeys.length}) vs entrada (${inputKeys.length})`);
    return false;
  }

  const match = inputKeys.every(key => {
    const combVal = variantesPlanas[key]?.toLowerCase?.();
    const inputVal = variantes[key]?.toLowerCase?.();
    const igual = combVal === inputVal;

    //console.log(`🔍 Comparando '${key}': ${combVal} vs ${inputVal} => ${igual ? '✅' : '❌'}`);
    return igual;
  });

  if (match) console.log(`¡MATCH encontrado con combinación #${index + 1}!`);

  return match;
});
  if (!combinacion) {
    console.error("❌ No se encontró la combinación correspondiente.");
    throw new Error("No se encontró la combinación");
  }

  console.log(`Actualizando stock a: ${nuevoStock}`);
  combinacion.stock = nuevoStock;

  return await producto.save();
};
const addVariantToProduct = async (
  productId: string,
  sucursalId: string,
  combinaciones: {
    variantes: Record<string, string>,
    precio: number,
    stock: number
  }[]
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  for (const nueva of combinaciones) {
    const yaExiste = sucursal.combinaciones.some(c =>
      Object.keys(c.variantes).length === Object.keys(nueva.variantes).length &&
      Object.keys(nueva.variantes).every(
        key => c.variantes[key]?.toLowerCase?.() === nueva.variantes[key]?.toLowerCase?.()
      )
    );
    if (!yaExiste) {
      sucursal.combinaciones.push(nueva);
    }
  }

  return await producto.save();
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
  updateStockOfSubvariant,
  updateStockByVariantCombination,
  addVariantToProduct
};
