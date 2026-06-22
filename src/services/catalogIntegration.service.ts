import { CategoriaModel } from "../entities/implements/CategoriaSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { canAccessSellerProductInfoByCommission } from "../utils";
import { createVariantKey } from "../utils/variantKey";

type ProductInfoStatus = "empty" | "partial" | "complete";

const toStringValue = (value: unknown) => String(value ?? "").trim();

const normalizeVariants = (value: unknown): Record<string, string> => {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, item]) => [String(key), toStringValue(item)])
    );
  }
  if (typeof (value as any)?.toObject === "function") {
    return normalizeVariants((value as any).toObject());
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      toStringValue(item)
    ])
  );
};

export const getCatalogVariantInfoStatus = (combination: any): ProductInfoStatus => {
  const hasDescription = Boolean(toStringValue(combination?.descripcion));
  const hasUsage = Boolean(toStringValue(combination?.uso));
  const hasImages = Array.isArray(combination?.imagenes) && combination.imagenes.length > 0;
  const promotion = combination?.promocion || {};
  const hasPromotion = Boolean(
    toStringValue(promotion?.titulo) ||
      toStringValue(promotion?.descripcion) ||
      promotion?.fechaInicio ||
      promotion?.fechaFin
  );

  if (!hasDescription && !hasUsage && !hasImages && !hasPromotion) return "empty";
  if (hasDescription && hasImages) return "complete";
  return "partial";
};

const statusRank = (status: ProductInfoStatus) =>
  status === "complete" ? 2 : status === "partial" ? 1 : 0;

const commercialInfoScore = (combination: any) => {
  const promotion = combination?.promocion || {};
  return (
    (toStringValue(combination?.descripcion) ? 8 : 0) +
    (toStringValue(combination?.uso) ? 4 : 0) +
    (toStringValue(promotion?.titulo) ||
    toStringValue(promotion?.descripcion) ||
    promotion?.fechaInicio ||
    promotion?.fechaFin
      ? 2
      : 0) +
    (Array.isArray(combination?.imagenes) && combination.imagenes.length > 0 ? 1 : 0)
  );
};

const buildSnapshot = async () => {
  const sellers = await VendedorModel.find({})
    .select(
      "nombre apellido marca mail telefono fecha_vigencia comision_porcentual comision_fija pago_sucursales"
    )
    .lean();

  const eligibleSellers = sellers.filter((seller: any) =>
    canAccessSellerProductInfoByCommission({
      comision_porcentual: Number(seller?.comision_porcentual ?? 0),
      comision_fija: Number(seller?.comision_fija ?? 0),
      fecha_vigencia: seller?.fecha_vigencia
    })
  );
  const eligibleSellerIds = new Set(eligibleSellers.map((seller: any) => String(seller._id)));

  const products = await ProductoModel.find({
    esTemporal: { $ne: true },
    id_vendedor: { $in: Array.from(eligibleSellerIds) }
  })
    .select("nombre_producto id_categoria id_vendedor sucursales updatedAt")
    .lean();

  const exportedProducts: any[] = [];
  const usedSellerIds = new Set<string>();
  const usedCategoryIds = new Set<string>();
  const usedBranchIds = new Set<string>();

  for (const product of products as any[]) {
    const productId = String(product._id);
    const variantsByKey = new Map<string, any>();

    for (const branch of product.sucursales || []) {
      const branchId = String(branch?.id_sucursal || "");
      if (!branchId) continue;

      for (const combination of branch?.combinaciones || []) {
        const variants = normalizeVariants(combination?.variantes);
        const variantKey =
          toStringValue(combination?.variantKey) || createVariantKey(productId, variants);
        const status = getCatalogVariantInfoStatus(combination);
        const existing = variantsByKey.get(variantKey);
        const branchStock = {
          internalBranchId: branchId,
          stock: Math.max(0, Number(combination?.stock || 0))
        };

        if (!existing) {
          variantsByKey.set(variantKey, {
            internalVariantKey: variantKey,
            name: Object.values(variants).filter(Boolean).join(" / ") || product.nombre_producto,
            attributes: variants,
            price: Math.max(0, Number(combination?.precio || 0)),
            infoStatus: status,
            description: toStringValue(combination?.descripcion) || null,
            usage: toStringValue(combination?.uso) || null,
            promotion: combination?.promocion || null,
            images: Array.isArray(combination?.imagenes) ? combination.imagenes : [],
            inventory: [branchStock],
            commercialInfoScore: commercialInfoScore(combination)
          });
        } else {
          existing.inventory.push(branchStock);
          const nextScore = commercialInfoScore(combination);
          if (
            statusRank(status) > statusRank(existing.infoStatus) ||
            (statusRank(status) === statusRank(existing.infoStatus) &&
              nextScore > existing.commercialInfoScore)
          ) {
            existing.infoStatus = status;
            existing.description = toStringValue(combination?.descripcion) || null;
            existing.usage = toStringValue(combination?.uso) || null;
            existing.promotion = combination?.promocion || null;
            existing.images = Array.isArray(combination?.imagenes) ? combination.imagenes : [];
            existing.commercialInfoScore = nextScore;
          }
        }
      }
    }

    const variants = Array.from(variantsByKey.values())
      .filter((variant) => variant.infoStatus !== "empty")
      .map(({ commercialInfoScore: _commercialInfoScore, ...variant }) => variant);
    if (!variants.length) continue;

    variants.forEach((variant) =>
      variant.inventory.forEach((inventory: any) => usedBranchIds.add(inventory.internalBranchId))
    );
    usedSellerIds.add(String(product.id_vendedor));
    usedCategoryIds.add(String(product.id_categoria));

    exportedProducts.push({
      internalProductId: productId,
      internalSellerId: String(product.id_vendedor),
      internalCategoryId: String(product.id_categoria),
      name: product.nombre_producto,
      updatedAt: product.updatedAt || null,
      variants
    });
  }

  const [categories, branches] = await Promise.all([
    CategoriaModel.find({ _id: { $in: Array.from(usedCategoryIds) } })
      .select("categoria")
      .lean(),
    SucursalModel.find({ _id: { $in: Array.from(usedBranchIds) } })
      .select("nombre direccion ciudad telefono")
      .lean()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    rules: {
      sellers: "product-info-access",
      variants: ["partial", "complete"]
    },
    sellers: eligibleSellers
      .filter((seller: any) => usedSellerIds.has(String(seller._id)))
      .map((seller: any) => ({
        internalSellerId: String(seller._id),
        displayName:
          toStringValue(seller.marca) ||
          `${toStringValue(seller.nombre)} ${toStringValue(seller.apellido)}`.trim(),
        firstName: toStringValue(seller.nombre),
        lastName: toStringValue(seller.apellido) || null,
        email: toStringValue(seller.mail) || null,
        phone: toStringValue(seller.telefono) || null
      })),
    categories: categories.map((category: any) => ({
      internalCategoryId: String(category._id),
      name: toStringValue(category.categoria) || "Sin categoria"
    })),
    branches: branches.map((branch: any) => ({
      internalBranchId: String(branch._id),
      name: toStringValue(branch.nombre) || "Sucursal",
      address: toStringValue(branch.direccion) || "Sin direccion",
      city: toStringValue(branch.ciudad) || "Bolivia",
      phone: toStringValue(branch.telefono) || null
    })),
    products: exportedProducts
  };
};

export const CatalogIntegrationService = {
  buildSnapshot
};
