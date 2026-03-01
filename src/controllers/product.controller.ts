import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";
import { ProductVariantQRService } from "../services/productVariantQR.service";
import { ProductVariantKeyService } from "../services/productVariantKey.service";

export const getProduct = async (req: Request, res: Response) => {
  try {
    const products = await ProductService.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
export const getTemporaryProducts = async (req: Request, res: Response) => {
  try {
    const products = await ProductService.getAllTemporaryProducts();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos temporales' });
  }
};


const registerProduct = async (req: Request, res: Response) => {
  
  const { product } = req.body;
  try {
    const newProduct = await ProductService.registerProduct(product);
    res.status(201).json({
      success: true,
      message: "Producto registrado correctamente",
      newProduct,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const registerProductVariants = async (req: Request, res: Response) => {
  console.log("📥 Body recibido en /register:", JSON.stringify(req.body, null, 2));

  try {
    const newProduct = await ProductService.registerProduct(req.body);
    res.status(201).json({ success: true, newProduct });
  } catch (error: any) {
    console.error("❌ Error al registrar variantes:", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Error al registrar producto con variantes",
      error: error?.message || error
    });
  }
};



export const getProductQR = async (req: Request, res: Response) => {
  const { id } = req.params;
  const format = req.query.format as 'path' | 'base64' || 'path';
  
  try {
    const qrData = await ProductService.getProductQR(id, format);
    res.json({
      success: true,
      qrData
    });
  } catch (error) {
    console.error("Error obteniendo QR:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener QR del producto", 
      error 
    });
  }
};

export const regenerateProductQR = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const qrData = await ProductService.regenerateProductQR(id);
    res.json({
      success: true,
      message: "QR regenerado correctamente",
      qrData
    });
  } catch (error) {
    console.error("Error regenerando QR:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al regenerar QR del producto", 
      error 
    });
  }
};

// Buscar producto por código QR
export const findProductByQR = async (req: Request, res: Response) => {
  const { qrCode } = req.params;
  
  try {
    const product = await ProductService.findProductByQRCode(qrCode);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado con ese código QR"
      });
    }
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error("Error buscando producto por QR:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al buscar producto por código QR", 
      error 
    });
  }
};

export const generateVariantQR = async (req: Request, res: Response) => {
  const { productId, variantKey, forceRegenerate } = req.body || {};

  if (!productId || !variantKey) {
    return res.status(400).json({
      success: false,
      message: "productId y variantKey son requeridos"
    });
  }

  try {
    const qrData = await ProductVariantQRService.generateVariantQR({
      productId,
      variantKey,
      forceRegenerate: Boolean(forceRegenerate)
    });

    res.json({
      success: true,
      qrData
    });
  } catch (error) {
    console.error("Error generando QR de variante:", error);
    res.status(500).json({
      success: false,
      message: "Error al generar QR de variante",
      error
    });
  }
};

export const batchGenerateVariantQR = async (req: Request, res: Response) => {
  const { sellerId, productIds, onlyMissing, forceRegenerate } = req.body || {};

  try {
    const result = await ProductVariantQRService.batchGenerateVariantQR({
      sellerId,
      productIds: Array.isArray(productIds) ? productIds : [],
      onlyMissing: onlyMissing !== false,
      forceRegenerate: Boolean(forceRegenerate)
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error en generación masiva QR de variantes:", error);
    res.status(500).json({
      success: false,
      message: "Error en generación masiva de QRs de variantes",
      error
    });
  }
};

export const listVariantQR = async (req: Request, res: Response) => {
  const sellerId = req.query.sellerId as string | undefined;
  const limitRaw = req.query.limit as string | undefined;
  const productIdsRaw = req.query.productIds as string | undefined;
  const productIds = productIdsRaw
    ? productIdsRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  try {
    const result = await ProductVariantQRService.listVariantQRs({
      sellerId,
      productIds,
      limit: limitRaw ? Number(limitRaw) : undefined
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error listando QRs de variantes:", error);
    res.status(500).json({
      success: false,
      message: "Error al listar QRs de variantes",
      error
    });
  }
};

export const findVariantByQRCode = async (req: Request, res: Response) => {
  const { qrCode } = req.params;
  const sucursalId = req.query.sucursalId as string | undefined;

  try {
    const item = await ProductVariantQRService.findVariantByQRCode(qrCode, sucursalId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "No se encontró variante con ese código QR"
      });
    }

    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error("Error buscando variante por QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al buscar variante por código QR",
      error
    });
  }
};

export const resolveVariantQRPayload = async (req: Request, res: Response) => {
  const payload = req.query.payload as string | undefined;
  const sucursalId = req.query.sucursalId as string | undefined;

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: "payload es requerido"
    });
  }

  try {
    const item = await ProductVariantQRService.resolveVariantQRPayload(payload, sucursalId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "No se pudo resolver el QR escaneado"
      });
    }

    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error("Error resolviendo payload QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al resolver payload QR",
      error
    });
  }
};

export const migrateVariantKeys = async (_req: Request, res: Response) => {
  try {
    const result = await ProductVariantKeyService.migrateVariantKeysForAllProducts();
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error migrando variantKey:", error);
    res.status(500).json({
      success: false,
      message: "Error al migrar variantKey",
      error
    });
  }
};

export const getProductCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const product = await ProductService.getProductById(id);
    const category = await CategoryService.getCategoryById(product.id_categoria);
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Internal Server Error', error });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const product = await ProductService.getProductById(id);
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Internal Server Error', error });
  }
};

export const getAllProductsEntryAmountBySellerId = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const stock = await ProductService.getAllProductsEntryAmountBySellerId(id);
    res.json(stock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error getting entry amount by seller Id', error });
  }
};

export const getFeatures = async (req: Request, res: Response) => {
  try {
    const features = await ProductService.getFeaturesById(req.params.id);
    res.json(features);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addFeatureToProduct = async (req: Request, res: Response) => {
  const { productId, features } = req.body;
  try {
    const result = [];
    for (let feature of features) {
      const r = await ProductService.addFeatureToProduct(productId, feature);
      result.push(r);
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getProductStock = async (req: Request, res: Response) => {
  const { idProduct, idSucursal } = req.params;
  try {
    const inventory = await ProductService.getProductStock(idProduct, idSucursal);
    res.json({ inventory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAllStockByProductId = async (req: Request, res: Response) => {
  try {
    const stock = await ProductService.getAllStockByProductId(req.params.idProduct);
    res.json(stock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updatePrice = async (req: Request, res: Response) => {
  try {
    const updated = await ProductService.updatePrice(req.body.priceUpdates);
    res.json({ success: true, updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al actualizar precios", error });
  }
};

export const updateSubvariantStock = async (req: Request, res: Response) => {
  //console.log("Updating subvariant stock");
  const { productId, sucursalId, variantes, stock } = req.body;  try {
    const result = await ProductService.updateStockByVariantCombination({
      productId,
      sucursalId,
      variantes,
      stock
  });

    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al actualizar stock", error });
  }
};
export const addVariantToProduct = async (req: Request, res: Response) => {
  try {
    const { productId, sucursalId, combinaciones } = req.body;
    const result = await ProductService.addVariantToProduct(productId, sucursalId, combinaciones);
    res.json({ success: true, result });
  } catch (error) {
    console.error("Error al agregar variante:", error);
    res.status(500).json({ success: false, message: "Error al agregar variante", error });
  }
};

export const generateIngressPDF = async (req: Request, res: Response) => {
  try {
    const pdfBuffer = await ProductService.generateIngressPDF(req.body);
    
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Comprobante_Ingresos.pdf",
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Error al generar PDF:", err);
    res.status(500).json({ success: false, message: "Error al generar PDF" });
  }
};




export const getFlatProductList = async (req: Request, res: Response) => {












  try {
    const sucursalId = req.query.sucursalId as string | undefined;
    const products = await ProductService.getFlatProductList(sucursalId);



    res.json(products);
  } catch (error) {
    console.error("Error en getFlatProductList:", error);
    res.status(500).json({ error: "Error al obtener productos optimizados" });
  }
};


export const ProductController = {
  getProduct,
  registerProduct,
  registerProductVariants,
  getProductById,
  getProductCategory,
  getAllProductsEntryAmountBySellerId,
  getFeatures,
  addFeatureToProduct,
  getProductStock,
  getAllStockByProductId,
  updatePrice,
  updateSubvariantStock,
  addVariantToProduct,
  generateIngressPDF,
  getTemporaryProducts,
  getFlatProductList,
  getProductQR,
  regenerateProductQR,
  findProductByQR,
  generateVariantQR,
  batchGenerateVariantQR,
  listVariantQR,
  findVariantByQRCode,
  resolveVariantQRPayload,
  migrateVariantKeys

};
