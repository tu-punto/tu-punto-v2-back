import { ProductoModel } from "../entities/implements/ProductoSchema";
import { IProductoDocument } from "../entities/documents/IProductoDocument";
import { createVariantKey, variantFingerprint } from "../utils/variantKey";

const applyVariantKeysToProduct = (product: IProductoDocument): boolean => {
  const productId = product._id.toString();
  let changed = false;

  const fingerprintToKey = new Map<string, string>();

  for (const sucursal of product.sucursales || []) {
    for (const combinacion of sucursal.combinaciones || []) {
      const fingerprint = variantFingerprint(combinacion.variantes as Record<string, string>);
      const existingKeyByFingerprint = fingerprintToKey.get(fingerprint);
      const key =
        existingKeyByFingerprint ||
        combinacion.variantKey ||
        createVariantKey(productId, combinacion.variantes as Record<string, string>);

      if (!existingKeyByFingerprint) {
        fingerprintToKey.set(fingerprint, key);
      }

      if (combinacion.variantKey !== key) {
        combinacion.variantKey = key;
        changed = true;
      }
    }
  }

  return changed;
};

const ensureVariantKeysForProductById = async (productId: string): Promise<boolean> => {
  const product = await ProductoModel.findById(productId);
  if (!product) return false;

  const changed = applyVariantKeysToProduct(product);
  if (changed) {
    await product.save();
  }

  return changed;
};

const migrateVariantKeysForAllProducts = async (): Promise<{
  processed: number;
  updated: number;
}> => {
  const products = await ProductoModel.find({});
  let processed = 0;
  let updated = 0;

  for (const product of products) {
    processed += 1;
    const changed = applyVariantKeysToProduct(product);
    if (changed) {
      await product.save();
      updated += 1;
    }
  }

  return { processed, updated };
};

export const ProductVariantKeyService = {
  applyVariantKeysToProduct,
  ensureVariantKeysForProductById,
  migrateVariantKeysForAllProducts
};

