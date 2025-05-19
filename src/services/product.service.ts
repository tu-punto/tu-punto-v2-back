import { ICaracteristicas } from "../entities/ICaracteristicas";
import { FeatureRepository } from "../repositories/feature.repository";
import { ProductRepository } from "../repositories/product.repository";

interface Feature {
  feature: string;
  values: string[];
}

const getAllProducts = async () => {
  return await ProductRepository.findAll();
};

const registerProduct = async (product: any): Promise<any> => {
  console.log("Service, product:",product);
    
  return await ProductRepository.registerProduct(product);
};

const getFeaturesById = async (productId: string) => {
  const product = await ProductRepository.findById(productId);
  if (!product)
    throw new Error("Doesn't exist such product with that id");

  const features = await FeatureRepository.getFeaturesByProductId(product);

  return features.reduce((acc, cur) => {
    const feature = acc.find(feat => feat.feature === cur.feature);
    if (feature) {
      feature.values.push(cur.value);
    } else {
      acc.push({ feature: cur.feature, values: [cur.value] });
    }
    return acc;
  }, [] as Feature[]);
};

const addFeatureToProduct = async (productId: string, featureData: any) => {
  const product = await ProductRepository.findById(productId);

  if (!product)
    throw new Error("Doesn't exist such product with that id");

  const feature: ICaracteristicas = {
    ...featureData,
    product: product._id // Solo el ObjectId
  };

  return await FeatureRepository.registerFeature(feature);
};

const getProductById = async (productId: string) => {
  const product = await ProductRepository.findById(productId);
  if (!product)
    throw new Error("Doesn't exist such product with that id");
  return product;
};

const getAllProductsEntryAmountBySellerId = async (sellerId: string) => {
  const products = await ProductRepository.findBySellerId(sellerId);
  if (!products)
    throw new Error("Doesn't exist such products with that seller id as fk");
  return products;
};

const getProductStock = async (productId: string, sucursalId: string) => {
  return await ProductRepository.getStockForSucursal(productId, sucursalId);
};
/*
const updateStock = async (updates: {
  productId: string;
  sucursalId: string;
  varianteNombre: string;
  stock: number;
  precio?: number;
}[]) => {
  const updatedList = [];

  for (let { productId, sucursalId, varianteNombre, stock, precio } of updates) {
    // Primero actualizamos el stock en la variante específica
    const updatedProduct = await ProductRepository.updateStockInSucursal(
      productId,
      sucursalId,
      varianteNombre,
      stock
    );

    // Luego, si se provee un nuevo precio, se actualiza el producto completo
    if (precio !== undefined) {
      await ProductRepository.updateProduct(productId});
    }

    updatedList.push(updatedProduct);
  }

  return updatedList;
};
*/
const getAllStockByProductId = async (productId: string) => {
    return await ProductRepository.getAllStockByProductId(productId);
  };


const addVariantToSucursal = async (
  productId: string,
  sucursalId: string,
  variant: { nombre_variante: string; precio: number; stock: number }
) => {
  return await ProductRepository.addVariantToSucursal(productId, sucursalId, variant);
};
const updatePrice = async (updates: {
  productId: string;
  sucursalId: string;
  varianteNombre: string;
  precio: number;
}[]) => {
  const updatedList = [];

  for (let { productId, sucursalId, varianteNombre, precio } of updates) {
    const updatedProduct = await ProductRepository.updatePriceInSucursal(
      productId,
      sucursalId,
      varianteNombre,
      precio
    );
    updatedList.push(updatedProduct);
  }

  return updatedList;
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

  

export const ProductService = {
  getAllProducts,
  registerProduct,
  getFeaturesById,
  getAllProductsEntryAmountBySellerId,
  addFeatureToProduct,
  getProductById,
  getProductStock,
  //updateStock,
  getAllStockByProductId,
  addVariantToSucursal,
  updatePrice,
  updateSubvariantStock
};
