import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";
import { ProductVariantQRService } from "../services/productVariantQR.service";
import { ProductVariantQRGroupService } from "../services/productVariantQRGroup.service";
import { ProductVariantKeyService } from "../services/productVariantKey.service";
import { UserModel } from "../entities/implements/UserSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { deleteFileFromS3, uploadVariantImageToS3 } from "../helpers/S3Client";
import { canAccessSellerProductInfo } from "../utils";

type SellerProductInfoAccessShape = {
  pago_sucursales?: {
    alquiler?: number;
    exhibicion?: number;
    delivery?: number;
    entrega_simple?: number;
    activo?: boolean;
  }[];
  comision_porcentual?: number;
  comision_fija?: number;
};

const resolveSellerIdByAuthUser = async (userId: string): Promise<string | null> => {
  const user = await UserModel.findById(userId).select("role vendedor email").lean();
  if (!user || String(user.role).toLowerCase() !== "seller") {
    return null;
  }

  if (user.vendedor) {
    return String(user.vendedor);
  }

  if (user.email) {
    const seller = await VendedorModel.findOne({ mail: user.email }).select("_id").lean();
    if (seller?._id) {
      return String(seller._id);
    }
  }

  return null;
};

const canAuthenticatedSellerAccessProductInfo = async (sellerId: string): Promise<boolean> => {
  const seller = await VendedorModel.findById(sellerId)
    .select("pago_sucursales comision_porcentual comision_fija")
    .lean();

  if (!seller) {
    return false;
  }

  const sellerAccessData = seller as unknown as SellerProductInfoAccessShape;
  return canAccessSellerProductInfo({
    pago_sucursales: Array.isArray(sellerAccessData.pago_sucursales)
      ? sellerAccessData.pago_sucursales
      : [],
    comision_porcentual: Number(sellerAccessData.comision_porcentual ?? 0),
    comision_fija: Number(sellerAccessData.comision_fija ?? 0),
  });
};

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "si", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return undefined;
};

const buildSellerProductInfoQueryParams = (req: Request, sellerId: string) => ({
  sellerId,
  sucursalId: req.query.sucursalId as string | undefined,
  categoryId: req.query.categoryId as string | undefined,
  q: req.query.q as string | undefined,
  inStock: parseBooleanQuery(req.query.inStock),
  hasPromotion: parseBooleanQuery(req.query.hasPromotion),
  hasImages: parseBooleanQuery(req.query.hasImages),
  hasDescription: parseBooleanQuery(req.query.hasDescription),
  page: Number(req.query.page || 1),
  limit: Number(req.query.limit || 10),
  sortOrder: req.query.sortOrder === "desc" ? "desc" : ("asc" as "asc" | "desc"),
});

const parseVariantScope = (value: unknown): "branch" | "all" => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "branch" ? "branch" : "all";
};

const getSellerBranchOptions = async (sellerId: string) => {
  const seller = await VendedorModel.findById(sellerId)
    .select("nombre apellido pago_sucursales")
    .lean();

  if (!seller) {
    return null;
  }

  return {
    sellerName:
      `${String((seller as any)?.nombre || "").trim()} ${String((seller as any)?.apellido || "").trim()}`.trim() ||
      "Vendedor",
    branches: (Array.isArray((seller as any)?.pago_sucursales) ? (seller as any).pago_sucursales : []).map(
      (branch: any) => ({
        sucursalId: String(branch?.id_sucursal || "").trim(),
        sucursalName: String(branch?.sucursalName || "Sucursal").trim() || "Sucursal"
      })
    )
  };
};

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
  const { sellerId, sucursalId, productIds, onlyMissing, forceRegenerate } = req.body || {};

  try {
    const result = await ProductVariantQRService.batchGenerateVariantQR({
      sellerId,
      sucursalId,
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
  const sucursalId = req.query.sucursalId as string | undefined;
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
      sucursalId,
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

export const createVariantQRGroup = async (req: Request, res: Response) => {
  const { name, sellerId, items } = req.body || {};

  if (!name || !sellerId || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      message: "name, sellerId e items son requeridos"
    });
  }

  try {
    const group = await ProductVariantQRGroupService.createGroup({
      name,
      sellerId,
      items
    });

    res.status(201).json({
      success: true,
      message: "Grupo QR creado correctamente",
      group
    });
  } catch (error) {
    console.error("Error creando grupo QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear grupo QR",
      error
    });
  }
};

export const updateVariantQRGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, items, active } = req.body || {};

  try {
    const group = await ProductVariantQRGroupService.updateGroup({
      id,
      name,
      items,
      active
    });

    res.json({
      success: true,
      message: "Grupo QR actualizado correctamente",
      group
    });
  } catch (error) {
    console.error("Error actualizando grupo QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar grupo QR",
      error
    });
  }
};

export const getVariantQRGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const sucursalId = req.query.sucursalId as string | undefined;

  try {
    const group = await ProductVariantQRGroupService.getGroupById(id, sucursalId);
    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error("Error obteniendo grupo QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener grupo QR",
      error
    });
  }
};

export const listVariantQRGroup = async (req: Request, res: Response) => {
  const sellerId = req.query.sellerId as string | undefined;
  const q = req.query.q as string | undefined;
  const limitRaw = req.query.limit as string | undefined;
  const activeRaw = req.query.active as string | undefined;
  const active =
    activeRaw === undefined
      ? undefined
      : activeRaw === "true" || activeRaw === "1";

  try {
    const result = await ProductVariantQRGroupService.listGroups({
      sellerId,
      q,
      active,
      limit: limitRaw ? Number(limitRaw) : undefined
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error listando grupos QR:", error);
    res.status(500).json({
      success: false,
      message: "Error al listar grupos QR",
      error
    });
  }
};

export const generateVariantQRGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { forceRegenerate } = req.body || {};

  try {
    const qrData = await ProductVariantQRGroupService.generateGroupQR({
      id,
      forceRegenerate: Boolean(forceRegenerate)
    });

    res.json({
      success: true,
      message: "QR de grupo generado correctamente",
      qrData
    });
  } catch (error) {
    console.error("Error generando QR de grupo:", error);
    res.status(500).json({
      success: false,
      message: "Error al generar QR de grupo",
      error
    });
  }
};

export const resolveVariantQRGroupPayload = async (req: Request, res: Response) => {
  const payload = req.query.payload as string | undefined;
  const sucursalId = req.query.sucursalId as string | undefined;

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: "payload es requerido"
    });
  }

  try {
    const group = await ProductVariantQRGroupService.resolveGroupQRPayload(payload, sucursalId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "No se pudo resolver el QR de grupo"
      });
    }

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error("Error resolviendo QR de grupo:", error);
    res.status(500).json({
      success: false,
      message: "Error al resolver QR de grupo",
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
    const payload = req.body?.priceUpdates ?? req.body;
    const updated = await ProductService.updatePrice(payload);
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
    const sellerId = req.query.sellerId as string | undefined;
    const sellerIdsRaw = req.query.sellerIds as string | undefined;
    const sellerIds = sellerIdsRaw
      ? sellerIdsRaw.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const q = req.query.q as string | undefined;
    const inStockRaw = req.query.inStock as string | undefined;
    const inStock =
      inStockRaw === undefined
        ? undefined
        : inStockRaw === "true" || inStockRaw === "1";

    const products = await ProductService.getFlatProductList({
      sucursalId,
      sellerId,
      sellerIds,
      categoryId,
      inStock,
      q
    });



    res.json(products);
  } catch (error) {
    console.error("Error en getFlatProductList:", error);
    res.status(500).json({ error: "Error al obtener productos optimizados" });
  }
};

export const getSellerInventoryAll = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    const authUserId = String(res.locals.auth?.id || "");

    let sellerId = req.query.sellerId as string | undefined;
    if (authRole === "seller" && authUserId) {
      sellerId = (await resolveSellerIdByAuthUser(authUserId)) || undefined;
    }

    if (!sellerId) {
      return res.status(400).json({ error: "sellerId no resuelto" });
    }

    const sucursalId = req.query.sucursalId as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const q = req.query.q as string | undefined;
    const inStockRaw = req.query.inStock as string | undefined;
    const inStock =
      inStockRaw === undefined
        ? undefined
        : inStockRaw === "true" || inStockRaw === "1";

    const rows = await ProductService.getFlatProductList({
      sellerId,
      sucursalId,
      categoryId,
      q,
      inStock
    });
    res.json(rows);
  } catch (error) {
    console.error("Error en getSellerInventoryAll:", error);
    res.status(500).json({ error: "Error al obtener inventario completo de vendedor" });
  }
};

export const getFlatProductListPage = async (req: Request, res: Response) => {
  try {
    const sucursalId = req.query.sucursalId as string | undefined;
    const sellerId = req.query.sellerId as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const q = req.query.q as string | undefined;
    const inStockRaw = req.query.inStock as string | undefined;
    const inStock =
      inStockRaw === undefined
        ? undefined
        : inStockRaw === "true" || inStockRaw === "1";
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    const result = await ProductService.getFlatProductListPage({
      sucursalId,
      sellerId,
      categoryId,
      inStock,
      q,
      page,
      limit
    });
    res.json(result);
  } catch (error) {
    console.error("Error en getFlatProductListPage:", error);
    res.status(500).json({ error: "Error al obtener productos optimizados paginados" });
  }
};

export const getSellerInventoryList = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    const authUserId = String(res.locals.auth?.id || "");

    let sellerId = req.query.sellerId as string | undefined;
    if (authRole === "seller" && authUserId) {
      sellerId = (await resolveSellerIdByAuthUser(authUserId)) || undefined;
    }

    if (!sellerId) {
      return res.status(400).json({ error: "sellerId no resuelto" });
    }

    const sucursalId = req.query.sucursalId as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const q = req.query.q as string | undefined;
    const inStockRaw = req.query.inStock as string | undefined;
    const inStock =
      inStockRaw === undefined
        ? undefined
        : inStockRaw === "true" || inStockRaw === "1";
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    const result = await ProductService.getFlatProductListPage({
      sellerId,
      sucursalId,
      categoryId,
      q,
      inStock,
      page,
      limit
    });
    res.json(result);
  } catch (error) {
    console.error("Error en getSellerInventoryList:", error);
    res.status(500).json({ error: "Error al obtener inventario de vendedor" });
  }
};

export const getSellerProductInfoList = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    const authUserId = String(res.locals.auth?.id || "");

    if (authRole !== "seller" || !authUserId) {
      return res.status(403).json({
        success: false,
        message: "Solo un vendedor autenticado puede consultar esta informacion"
      });
    }

    const sellerId = await resolveSellerIdByAuthUser(authUserId);
    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "sellerId no resuelto"
      });
    }
    const hasAccess = await canAuthenticatedSellerAccessProductInfo(sellerId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Esta funcion requiere pago mensual y comision activos"
      });
    }

    const result = await ProductService.getSellerProductInfoListPage(
      buildSellerProductInfoQueryParams(req, sellerId)
    );

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error en getSellerProductInfoList:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener informacion de productos del vendedor"
    });
  }
};

export const getAdminSellerProductInfoList = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    if (!["admin", "superadmin"].includes(authRole)) {
      return res.status(403).json({
        success: false,
        message: "Solo un administrador puede consultar esta informacion"
      });
    }

    const sellerId = String(req.query.sellerId || "").trim();
    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "sellerId es requerido"
      });
    }

    const hasAccess = await canAuthenticatedSellerAccessProductInfo(sellerId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "El vendedor seleccionado no tiene habilitada esta funcion"
      });
    }

    const result = await ProductService.getSellerProductInfoListPage(
      buildSellerProductInfoQueryParams(req, sellerId)
    );

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error en getAdminSellerProductInfoList:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener informacion de productos del vendedor para administrador"
    });
  }
};

export const getSuperadminVariantInventoryList = async (req: Request, res: Response) => {
  try {
    const sellerId = String(req.query.sellerId || "").trim();
    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "sellerId es requerido"
      });
    }

    const sellerMeta = await getSellerBranchOptions(sellerId);
    if (!sellerMeta) {
      return res.status(404).json({
        success: false,
        message: "Vendedor no encontrado"
      });
    }

    const result = await ProductService.getSuperadminVariantInventoryPage({
      sellerId,
      q: String(req.query.q || "").trim() || undefined,
      inStock: parseBooleanQuery(req.query.inStock),
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      sortOrder: req.query.sortOrder === "desc" ? "desc" : "asc"
    });

    return res.json({
      success: true,
      sellerName: sellerMeta.sellerName,
      branches: sellerMeta.branches,
      ...result
    });
  } catch (error) {
    console.error("Error en getSuperadminVariantInventoryList:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener variantes del vendedor"
    });
  }
};

export const updateVariantStockByBranchForSuperadmin = async (req: Request, res: Response) => {
  try {
    const { productId, sellerId, variantKey, sucursalId, stock } = req.body || {};

    const result = await ProductService.updateVariantStockByBranchForSuperadmin({
      productId: String(productId || "").trim(),
      sellerId: String(sellerId || "").trim(),
      variantKey: String(variantKey || "").trim(),
      sucursalId: String(sucursalId || "").trim(),
      stock: Number(stock)
    });

    return res.json({
      success: true,
      message: "Stock actualizado correctamente",
      result
    });
  } catch (error: any) {
    console.error("Error en updateVariantStockByBranchForSuperadmin:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Error al actualizar el stock"
    });
  }
};

export const renameVariantForSuperadmin = async (req: Request, res: Response) => {
  try {
    const { productId, sellerId, variantKey, sucursalId, scope, variantAttributes } = req.body || {};

    const result = await ProductService.renameVariantForSuperadmin({
      productId: String(productId || "").trim(),
      sellerId: String(sellerId || "").trim(),
      variantKey: String(variantKey || "").trim(),
      sucursalId: String(sucursalId || "").trim() || undefined,
      scope: parseVariantScope(scope),
      variantAttributes:
        variantAttributes && typeof variantAttributes === "object" && !Array.isArray(variantAttributes)
          ? variantAttributes
          : {}
    });

    return res.json({
      success: true,
      message: "Variante actualizada correctamente",
      result
    });
  } catch (error: any) {
    console.error("Error en renameVariantForSuperadmin:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Error al actualizar la variante"
    });
  }
};

export const deleteVariantForSuperadmin = async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};

    const result = await ProductService.deleteVariantForSuperadmin({
      productId: String(payload.productId || "").trim(),
      sellerId: String(payload.sellerId || "").trim(),
      variantKey: String(payload.variantKey || "").trim(),
      sucursalId: String(payload.sucursalId || "").trim() || undefined,
      scope: parseVariantScope(payload.scope)
    });

    return res.json({
      success: true,
      message: result?.deletedProduct
        ? "Producto eliminado completamente porque no quedaron variantes"
        : "Variante eliminada correctamente",
      result
    });
  } catch (error: any) {
    console.error("Error en deleteVariantForSuperadmin:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Error al eliminar la variante"
    });
  }
};

export const updateVariantExtrasBySeller = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    const authUserId = String(res.locals.auth?.id || "");
    if (authRole !== "seller" || !authUserId) {
      return res.status(403).json({
        success: false,
        message: "Solo un vendedor autenticado puede editar esta variante"
      });
    }
    const sellerId = await resolveSellerIdByAuthUser(authUserId);
    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "sellerId no resuelto"
      });
    }
    const hasAccess = await canAuthenticatedSellerAccessProductInfo(sellerId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Esta funcion requiere pago mensual y comision activos"
      });
    }
    const { productId, sucursalId, variantKey } = req.params;
    const { descripcion, uso } = req.body;
    const clearImages = parseBooleanQuery(req.body.clearImages) === true;
    const previousImages = await ProductService.getSellerVariantImages({
      productId,
      variantKey,
      sellerId
    });
    let promocion: any = undefined;
    let retainedImages: { uid?: string; key?: string; url: string }[] | undefined = undefined;
    let imageOrder: string[] | undefined = undefined;
    let newImageUids: string[] | undefined = undefined;
    if (req.body.promocion !== undefined) {
      try {
        promocion =
          typeof req.body.promocion === "string"
            ? JSON.parse(req.body.promocion)
            : req.body.promocion;
      } catch (_error) {
        return res.status(400).json({
          success: false,
          message: "El campo promocion debe tener formato JSON valido"
        });
      }
    }
    if (req.body.retainedImages !== undefined) {
      try {
        retainedImages =
          typeof req.body.retainedImages === "string"
            ? JSON.parse(req.body.retainedImages)
            : req.body.retainedImages;
        if (!Array.isArray(retainedImages)) {
          throw new Error("retainedImages debe ser un arreglo");
        }
        retainedImages = retainedImages
          .filter((image) => image && typeof image.url === "string" && image.url.trim())
          .map((image) => ({
            uid: image.uid ? String(image.uid).trim() : undefined,
            url: String(image.url).trim(),
            key: image.key ? String(image.key).trim() : undefined
          }));
      } catch (_error) {
        return res.status(400).json({
          success: false,
          message: "El campo retainedImages debe tener formato JSON valido"
        });
      }
    }
    if (req.body.imageOrder !== undefined) {
      try {
        imageOrder =
          typeof req.body.imageOrder === "string"
            ? JSON.parse(req.body.imageOrder)
            : req.body.imageOrder;
        if (!Array.isArray(imageOrder)) {
          throw new Error("imageOrder debe ser un arreglo");
        }
        imageOrder = imageOrder
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      } catch (_error) {
        return res.status(400).json({
          success: false,
          message: "El campo imageOrder debe tener formato JSON valido"
        });
      }
    }
    if (req.body.newImageUids !== undefined) {
      try {
        newImageUids =
          typeof req.body.newImageUids === "string"
            ? JSON.parse(req.body.newImageUids)
            : req.body.newImageUids;
        if (!Array.isArray(newImageUids)) {
          throw new Error("newImageUids debe ser un arreglo");
        }
        newImageUids = newImageUids
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      } catch (_error) {
        return res.status(400).json({
          success: false,
          message: "El campo newImageUids debe tener formato JSON valido"
        });
      }
    }
    const files = req.files as Express.Multer.File[] | undefined;
    let imagenes: { key?: string; url: string }[] | undefined = undefined;
    let uploadedImages: { key: string; url: string }[] = [];
    if (files && files.length > 0) {
      uploadedImages = await Promise.all(
        files.map((file) =>
          uploadVariantImageToS3(file.buffer, file.originalname, file.mimetype)
        )
      );
    }
    if (clearImages || retainedImages !== undefined || uploadedImages.length > 0) {
      const existingByUid = new Map<string, { key?: string; url: string }>();
      const uploadedByUid = new Map<string, { key: string; url: string }>();
      (clearImages ? [] : retainedImages || []).forEach((image) => {
        const uid = String(image.uid || image.key || image.url || "").trim();
        if (!uid) return;
        existingByUid.set(uid, {
          key: image.key,
          url: image.url
        });
      });
      uploadedImages.forEach((image, index) => {
        const uid = String(newImageUids?.[index] || "").trim();
        if (!uid) return;
        uploadedByUid.set(uid, image);
      });
      if (imageOrder && imageOrder.length > 0) {
        imagenes = imageOrder
          .map((uid) => existingByUid.get(uid) || uploadedByUid.get(uid))
          .filter((image): image is { key?: string; url: string } => Boolean(image));
      } else {
        imagenes = [
          ...(clearImages ? [] : retainedImages || []).map((image) => ({
            key: image.key,
            url: image.url
          })),
          ...uploadedImages
        ];
      }
      if (imagenes.length > 4) {
        return res.status(400).json({
          success: false,
          message: "Solo se permiten maximo 4 imagenes"
        });
      }
    }
    const result = await ProductService.updateVariantExtrasBySeller({
      productId,
      sucursalId,
      variantKey,
      sellerId,
      descripcion,
      uso,
      promocion,
      imagenes
    });
    if (imagenes !== undefined) {
      const finalKeys = new Set(
        imagenes
          .map((image) => String(image?.key || "").trim())
          .filter(Boolean)
      );
      const removedKeys = previousImages
        .map((image: any) => String(image?.key || "").trim())
        .filter((key: string) => Boolean(key) && !finalKeys.has(key));
      if (removedKeys.length > 0) {
        Promise.allSettled(removedKeys.map((key) => deleteFileFromS3(key))).then((results) => {
          const failures = results.filter((item) => item.status === "rejected");
          if (failures.length > 0) {
            console.error("No se pudieron eliminar algunas imagenes antiguas de S3:", failures.length);
          }
        });
      }
    }
    return res.json({
      success: true,
      message: "Extras de la variante actualizados correctamente",
      result
    });
  } catch (error: any) {
    console.error("Error en updateVariantExtrasBySeller:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Error al actualizar extras de la variante"
    });
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
  getSellerInventoryAll,
  getFlatProductListPage,
  getSellerInventoryList,
  getSellerProductInfoList,
  getAdminSellerProductInfoList,
  getSuperadminVariantInventoryList,
  updateVariantStockByBranchForSuperadmin,
  renameVariantForSuperadmin,
  deleteVariantForSuperadmin,
  getProductQR,
  regenerateProductQR,
  findProductByQR,
  generateVariantQR,
  batchGenerateVariantQR,
  listVariantQR,
  findVariantByQRCode,
  resolveVariantQRPayload,
  createVariantQRGroup,
  updateVariantQRGroup,
  getVariantQRGroup,
  listVariantQRGroup,
  generateVariantQRGroup,
  resolveVariantQRGroupPayload,
  migrateVariantKeys,
  updateVariantExtrasBySeller

};


