import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { IProductoDocument } from "../entities/documents/IProductoDocument";
import { ProductVariantQRModel } from "../entities/implements/ProductVariantQRSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { ProductRepository } from "../repositories/product.repository";
import { QRService } from "./qr.service";
import { ProductVariantKeyService } from "./productVariantKey.service";
import { variantLabel } from "../utils/variantKey";

type VariantMap = Record<string, string>;

interface VariantResolutionItem {
  id_producto: string;
  nombre_producto: string;
  id_vendedor: string;
  variantKey: string;
  variantLabel: string;
  variantes: VariantMap;
  precio: number;
  stock: number;
  sucursalId: string;
  qrCode: string;
  qrPayload: string;
  qrImagePath: string;
  source: "variant_qr" | "legacy_product_qr";
}

interface VariantQRListItem {
  productId: string;
  productName: string;
  variantKey: string;
  variantLabel: string;
  qrCode: string;
  qrPayload: string;
  qrImagePath: string;
  updatedAt?: Date;
}

const toVariantMap = (variantes: unknown): VariantMap => {
  if (!variantes) return {};

  if (variantes instanceof Map) {
    return Object.fromEntries(
      Array.from(variantes.entries()).map(([key, value]) => [String(key), String(value)])
    );
  }

  return Object.fromEntries(
    Object.entries(variantes as Record<string, unknown>).map(([key, value]) => [
      String(key),
      String(value ?? "")
    ])
  );
};

const buildVariantQRToken = (): string => {
  return `PVAR-${uuidv4().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
};

const buildVariantQRPayload = (qrCode: string): string => `TP|v1|PVAR|${qrCode}`;

const findVariantInProduct = (
  product: IProductoDocument,
  variantKey: string,
  preferredSucursalId?: string
): { sucursalId: string; combinacion: { variantes: VariantMap; precio: number; stock: number } } | null => {
  const byPreferredSucursal =
    preferredSucursalId &&
    product.sucursales.find((sucursal) =>
      String(sucursal.id_sucursal) === preferredSucursalId &&
      sucursal.combinaciones.some((c) => c.variantKey === variantKey)
    );

  if (byPreferredSucursal) {
    const combinacion = byPreferredSucursal.combinaciones.find((c) => c.variantKey === variantKey);
    if (!combinacion) return null;

    return {
      sucursalId: String(byPreferredSucursal.id_sucursal),
      combinacion: {
        variantes: toVariantMap(combinacion.variantes),
        precio: Number(combinacion.precio ?? 0),
        stock: Number(combinacion.stock ?? 0)
      }
    };
  }

  for (const sucursal of product.sucursales) {
    const combinacion = sucursal.combinaciones.find((c) => c.variantKey === variantKey);
    if (combinacion) {
      return {
        sucursalId: String(sucursal.id_sucursal),
        combinacion: {
          variantes: toVariantMap(combinacion.variantes),
          precio: Number(combinacion.precio ?? 0),
          stock: Number(combinacion.stock ?? 0)
        }
      };
    }
  }

  return null;
};

const buildResolutionItem = (
  product: IProductoDocument,
  variantKey: string,
  qrDoc: { qrCode: string; qrPayload: string; qrImagePath: string },
  preferredSucursalId?: string,
  source: VariantResolutionItem["source"] = "variant_qr"
): VariantResolutionItem | null => {
  const variantFound = findVariantInProduct(product, variantKey, preferredSucursalId);
  if (!variantFound) return null;

  return {
    id_producto: String(product._id),
    nombre_producto: product.nombre_producto,
    id_vendedor: String(product.id_vendedor),
    variantKey,
    variantLabel: variantLabel(variantFound.combinacion.variantes),
    variantes: variantFound.combinacion.variantes,
    precio: variantFound.combinacion.precio,
    stock: variantFound.combinacion.stock,
    sucursalId: variantFound.sucursalId,
    qrCode: qrDoc.qrCode,
    qrPayload: qrDoc.qrPayload,
    qrImagePath: qrDoc.qrImagePath,
    source
  };
};

const generateVariantQR = async (params: {
  productId: string;
  variantKey: string;
  forceRegenerate?: boolean;
}): Promise<{
  created: boolean;
  qrCode: string;
  qrPayload: string;
  qrImagePath: string;
  variantKey: string;
  variantLabel: string;
  productId: string;
  productName: string;
}> => {
  const { productId, variantKey, forceRegenerate = false } = params;

  await ProductVariantKeyService.ensureVariantKeysForProductById(productId);
  const product = await ProductoModel.findById(productId);
  if (!product) throw new Error("Producto no encontrado");

  const variantFound = findVariantInProduct(product as IProductoDocument, variantKey);
  if (!variantFound) {
    throw new Error("Variante no encontrada para ese producto");
  }

  let qrDoc = await ProductVariantQRModel.findOne({
    productId: new Types.ObjectId(productId),
    variantKey
  });

  if (qrDoc && !forceRegenerate) {
    return {
      created: false,
      qrCode: qrDoc.qrCode,
      qrPayload: qrDoc.qrPayload,
      qrImagePath: qrDoc.qrImagePath,
      variantKey: qrDoc.variantKey,
      variantLabel: qrDoc.variantLabel,
      productId: String(qrDoc.productId),
      productName: product.nombre_producto
    };
  }

  const qrCode = buildVariantQRToken();
  const qrPayload = buildVariantQRPayload(qrCode);
  const { qrPath } = await QRService.generatePayloadQRToS3(
    qrPayload,
    `variant-${productId}-${variantKey}`
  );

  const variantes = variantFound.combinacion.variantes;
  const variantLabelText = variantLabel(variantes);

  if (qrDoc) {
    qrDoc.qrCode = qrCode;
    qrDoc.qrPayload = qrPayload;
    qrDoc.qrImagePath = qrPath;
    qrDoc.variantLabel = variantLabelText;
    qrDoc.variantes = new Map(Object.entries(variantes));
    qrDoc.active = true;
    await qrDoc.save();
  } else {
    qrDoc = await ProductVariantQRModel.create({
      productId: new Types.ObjectId(productId),
      variantKey,
      variantLabel: variantLabelText,
      variantes,
      qrCode,
      qrPayload,
      qrImagePath: qrPath,
      active: true
    });
  }

  return {
    created: true,
    qrCode: qrDoc.qrCode,
    qrPayload: qrDoc.qrPayload,
    qrImagePath: qrDoc.qrImagePath,
    variantKey: qrDoc.variantKey,
    variantLabel: qrDoc.variantLabel,
    productId: String(qrDoc.productId),
    productName: product.nombre_producto
  };
};

const batchGenerateVariantQR = async (params: {
  sellerId?: string;
  productIds?: string[];
  onlyMissing?: boolean;
  forceRegenerate?: boolean;
}): Promise<{
  products: number;
  variantsProcessed: number;
  generated: number;
  skipped: number;
  generatedItems: {
    productId: string;
    productName: string;
    variantKey: string;
    variantLabel: string;
    qrCode: string;
    qrImagePath: string;
  }[];
  errors: { productId: string; variantKey: string; message: string }[];
}> => {
  const { sellerId, productIds = [], onlyMissing = true, forceRegenerate = false } = params;
  const query: Record<string, unknown> = { esTemporal: { $ne: true } };

  if (sellerId) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new Error("sellerId inválido");
    }
    query.id_vendedor = new Types.ObjectId(sellerId);
  }

  if (productIds.length > 0) {
    const validIds = productIds.filter((id) => Types.ObjectId.isValid(id));
    query._id = { $in: validIds.map((id) => new Types.ObjectId(id)) };
  }

  const products = await ProductoModel.find(query);
  let variantsProcessed = 0;
  let generated = 0;
  let skipped = 0;
  const generatedItems: {
    productId: string;
    productName: string;
    variantKey: string;
    variantLabel: string;
    qrCode: string;
    qrImagePath: string;
  }[] = [];
  const errors: { productId: string; variantKey: string; message: string }[] = [];

  for (const product of products) {
    const productId = String(product._id);

    const changed = ProductVariantKeyService.applyVariantKeysToProduct(product as IProductoDocument);
    if (changed) {
      await product.save();
    }

    const variantKeys = new Set<string>();
    for (const sucursal of product.sucursales || []) {
      for (const combinacion of sucursal.combinaciones || []) {
        if (combinacion.variantKey) {
          variantKeys.add(combinacion.variantKey);
        }
      }
    }

    for (const key of variantKeys) {
      variantsProcessed += 1;

      const existing = await ProductVariantQRModel.findOne({
        productId: product._id,
        variantKey: key
      });

      if (onlyMissing && !forceRegenerate && existing) {
        skipped += 1;
        continue;
      }

      try {
        const result = await generateVariantQR({
          productId,
          variantKey: key,
          forceRegenerate
        });

        if (result.created) {
          generated += 1;
          generatedItems.push({
            productId: result.productId,
            productName: result.productName || product.nombre_producto,
            variantKey: result.variantKey,
            variantLabel: result.variantLabel,
            qrCode: result.qrCode,
            qrImagePath: result.qrImagePath
          });
        } else {
          skipped += 1;
        }
      } catch (error) {
        errors.push({
          productId,
          variantKey: key,
          message: error instanceof Error ? error.message : "Error inesperado"
        });
      }
    }
  }

  return {
    products: products.length,
    variantsProcessed,
    generated,
    skipped,
    generatedItems,
    errors
  };
};

const findVariantByQRCode = async (
  qrCode: string,
  preferredSucursalId?: string
): Promise<VariantResolutionItem | null> => {
  const qrDoc = await ProductVariantQRModel.findOne({ qrCode, active: true });
  if (!qrDoc) return null;

  const product = await ProductRepository.findById(String(qrDoc.productId));
  if (!product) return null;

  return buildResolutionItem(
    product as IProductoDocument,
    qrDoc.variantKey,
    {
      qrCode: qrDoc.qrCode,
      qrPayload: qrDoc.qrPayload,
      qrImagePath: qrDoc.qrImagePath
    },
    preferredSucursalId
  );
};

const resolveLegacyProductQR = async (
  qrCode: string,
  preferredSucursalId?: string
): Promise<VariantResolutionItem | null> => {
  const product = await ProductRepository.findByQRCode(qrCode);
  if (!product) return null;

  const changed = ProductVariantKeyService.applyVariantKeysToProduct(product as IProductoDocument);
  if (changed) {
    await (product as IProductoDocument).save();
  }

  const preferredSucursal =
    preferredSucursalId &&
    product.sucursales.find((sucursal) => String(sucursal.id_sucursal) === preferredSucursalId);
  const fallbackSucursal =
    preferredSucursal ||
    product.sucursales.find((sucursal) => sucursal.combinaciones.length > 0) ||
    product.sucursales[0];

  const combinacion = fallbackSucursal?.combinaciones[0];
  if (!fallbackSucursal || !combinacion || !combinacion.variantKey) return null;

  const variantes = toVariantMap(combinacion.variantes);

  return {
    id_producto: String(product._id),
    nombre_producto: product.nombre_producto,
    id_vendedor: String(product.id_vendedor),
    variantKey: combinacion.variantKey,
    variantLabel: variantLabel(variantes),
    variantes,
    precio: Number(combinacion.precio ?? 0),
    stock: Number(combinacion.stock ?? 0),
    sucursalId: String(fallbackSucursal.id_sucursal),
    qrCode,
    qrPayload: `LEGACY|${qrCode}`,
    qrImagePath: product.qrImagePath || "",
    source: "legacy_product_qr"
  };
};

const extractCodeFromPayload = (payload: string): string | null => {
  const value = payload?.trim();
  if (!value) return null;

  const parts = value.split("|");
  if (parts.length === 4 && parts[0] === "TP" && parts[1] === "v1" && parts[2] === "PVAR") {
    return parts[3];
  }

  try {
    const url = new URL(value);
    const queryQr = url.searchParams.get("qr");
    if (queryQr) return queryQr;
  } catch {
    // no-op
  }

  return value;
};

const resolveVariantQRPayload = async (
  payload: string,
  preferredSucursalId?: string
): Promise<VariantResolutionItem | null> => {
  const code = extractCodeFromPayload(payload);
  if (!code) return null;

  const byVariantCode = await findVariantByQRCode(code, preferredSucursalId);
  if (byVariantCode) return byVariantCode;

  return resolveLegacyProductQR(code, preferredSucursalId);
};

const listVariantQRs = async (params: {
  sellerId?: string;
  productIds?: string[];
  limit?: number;
}): Promise<{ count: number; items: VariantQRListItem[] }> => {
  const { sellerId, productIds = [], limit = 300 } = params;
  const qrQuery: Record<string, unknown> = { active: true };
  let filteredProductIds: Types.ObjectId[] | null = null;

  const hasSellerFilter = Boolean(sellerId);
  const hasProductFilter = productIds.length > 0;

  if (hasSellerFilter || hasProductFilter) {
    const productQuery: Record<string, unknown> = { esTemporal: { $ne: true } };

    if (sellerId) {
      if (!Types.ObjectId.isValid(sellerId)) {
        throw new Error("sellerId invÃ¡lido");
      }
      productQuery.id_vendedor = new Types.ObjectId(sellerId);
    }

    if (hasProductFilter) {
      const validIds = productIds.filter((id) => Types.ObjectId.isValid(id));
      productQuery._id = { $in: validIds.map((id) => new Types.ObjectId(id)) };
    }

    const filteredProducts = await ProductoModel.find(productQuery).select("_id");
    filteredProductIds = filteredProducts.map((p) => new Types.ObjectId(String(p._id)));

    if (filteredProductIds.length === 0) {
      return { count: 0, items: [] };
    }

    qrQuery.productId = { $in: filteredProductIds };
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 300, 1000));
  const [count, qrDocs] = await Promise.all([
    ProductVariantQRModel.countDocuments(qrQuery),
    ProductVariantQRModel.find(qrQuery).sort({ updatedAt: -1 }).limit(safeLimit)
  ]);

  if (!qrDocs.length) {
    return { count, items: [] };
  }

  const productIdsForMap = Array.from(
    new Set(qrDocs.map((doc) => String(doc.productId)))
  )
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const products = await ProductoModel.find({ _id: { $in: productIdsForMap } }).select(
    "_id nombre_producto"
  );
  const productNameById = new Map<string, string>(
    products.map((product) => [String(product._id), product.nombre_producto])
  );

  const items: VariantQRListItem[] = qrDocs.map((doc) => ({
    productId: String(doc.productId),
    productName: productNameById.get(String(doc.productId)) || "Producto",
    variantKey: doc.variantKey,
    variantLabel: doc.variantLabel,
    qrCode: doc.qrCode,
    qrPayload: doc.qrPayload,
    qrImagePath: doc.qrImagePath,
    updatedAt: doc.updatedAt
  }));

  return { count, items };
};

export const ProductVariantQRService = {
  generateVariantQR,
  batchGenerateVariantQR,
  listVariantQRs,
  findVariantByQRCode,
  resolveVariantQRPayload
};
