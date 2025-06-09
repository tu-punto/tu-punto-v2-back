import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";

export const getProduct = async (req: Request, res: Response) => {
  try {
    const products = await ProductService.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
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
  console.log("Registering product with variants", req.body);

  try {
    const newProduct = await ProductService.registerProduct(req.body); // ✅ usa req.body directamente
    res.json({ success: true, newProduct });
  } catch (error) {
    console.error("Error al registrar variantes:", error);
    res.status(500).json({ success: false, message: "Error al registrar producto con variantes" });
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
  generateIngressPDF
};
