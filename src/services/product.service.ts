import { ProductRepository } from "../repositories/product.repository";
import { FeatureRepository } from "../repositories/feature.repository";
import { ICaracteristicas } from "../entities/ICaracteristicas";
import { IProducto } from "../entities/IProducto";
import { VendedorModel } from "../entities/implements/VendedorSchema";

interface Feature {
  feature: string;
  values: string[];
}

const getAllProducts = async () => {
  return await ProductRepository.findAll();
};

const registerProduct = async (product: IProducto): Promise<any> => {
  const nuevoProducto = await ProductRepository.registerProduct(product);

  if (nuevoProducto.id_vendedor) {
    await VendedorModel.findByIdAndUpdate(
      nuevoProducto.id_vendedor,
      { $push: { producto: nuevoProducto._id } }
    );
  }

  return nuevoProducto;
};

const getFeaturesById = async (productId: string) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw new Error("Producto no encontrado");

  const features = await FeatureRepository.getFeaturesByProductId(product);

  return features.reduce((acc, cur) => {
    const existing = acc.find(f => f.feature === cur.feature);
    if (existing) {
      existing.values.push(cur.value);
    } else {
      acc.push({ feature: cur.feature, values: [cur.value] });
    }
    return acc;
  }, [] as Feature[]);
};

const addFeatureToProduct = async (productId: string, featureData: any) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw new Error("Producto no encontrado");

  const feature: ICaracteristicas = {
    ...featureData,
    product: product._id
  };

  return await FeatureRepository.registerFeature(feature);
};

const getProductById = async (productId: string) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw new Error("Producto no encontrado");
  return product;
};

const getAllProductsEntryAmountBySellerId = async (sellerId: string) => {
  const products = await ProductRepository.findBySellerId(sellerId);
  if (!products) throw new Error("No hay productos para ese vendedor");
  return products;
};

const getProductStock = async (productId: string, sucursalId: string) => {
  return await ProductRepository.getStockForSucursal(productId, sucursalId);
};

const getAllStockByProductId = async (productId: string) => {
  return await ProductRepository.getAllStockByProductId(productId);
};

const updateStockInSucursal = async (
  productId: string,
  sucursalId: string,
  variante: string,
  stock: number
) => {
  return await ProductRepository.updateStockInSucursal(productId, sucursalId, variante, stock);
};

const updatePrice = async (
  updates: {
    productId: string;
    sucursalId: string;
    variantes: Record<string, string>;
    precio: number;
  }[]
) => {
  const result = [];
  for (const u of updates) {
    const updated = await ProductRepository.updatePriceInSucursal(
      u.productId,
      u.sucursalId,
      u.variantes,
      u.precio
    );
    result.push(updated);
  }
  return result;
};


const updateSubvariantStock = async (params: {
  productId: string;
  sucursalId: string;
  varianteNombre: string;
  subvarianteNombre: string;
  stock: number;
}) => {
  return await ProductRepository.updateStockOfSubvariant(
    params.productId,
    params.sucursalId,
    params.varianteNombre,
    params.subvarianteNombre,
    params.stock
  );
};
const updateStockByVariantCombination = async ({
  productId,
  sucursalId,
  variantes,
  stock
}: {
  productId: string,
  sucursalId: string,
  variantes: Record<string, string>,
  stock: number
}) => {
  return await ProductRepository.updateStockByVariantCombination(productId, sucursalId, variantes, stock);
};
const addVariantToProduct = async (
  productId: string,
  sucursalId: string,
  combinaciones: {
    variantes: Record<string, string>,
    precio: number,
    stock: number
  }[]
) => {
  return await ProductRepository.addVariantToProduct(productId, sucursalId, combinaciones);
};


export const ProductService = {
  getAllProducts,
  registerProduct,
  getFeaturesById,
  getAllProductsEntryAmountBySellerId,
  addFeatureToProduct,
  getProductById,
  getProductStock,
  getAllStockByProductId,
  updateStockInSucursal,
  updatePrice,
  updateSubvariantStock,
  updateStockByVariantCombination,
  addVariantToProduct
};
