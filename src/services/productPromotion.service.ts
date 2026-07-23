import { Types } from "mongoose";
import { ProductPromotionModel } from "../entities/implements/ProductPromotionSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { createVariantKey } from "../utils/variantKey";

type PromotionScope = "interno" | "catalogo" | "ambos";
type PromotionState = "draft" | "active" | "disabled";

type PromotionTierInput = {
  minQuantity: number;
  unitPrice: number;
};

type PromotionInput = {
  sellerId: string;
  productId: string;
  variantKey: string;
  scope: PromotionScope;
  title?: string;
  simplePrice?: number | null;
  tiers?: PromotionTierInput[];
  startsAt: Date | string;
  endsAt: Date | string;
  state?: PromotionState;
};

type PricingPreviewInput = {
  sellerId?: string;
  productId: string;
  variantKey: string;
  scope: PromotionScope;
  quantity: number;
  simplePrice?: number | null;
  tiers?: PromotionTierInput[];
  startsAt?: Date | string;
  endsAt?: Date | string;
};

const text = (value: unknown) => String(value ?? "").trim();
const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const normalizeTierList = (tiers: PromotionTierInput[] = []) =>
  tiers
    .map((tier) => ({
      minQuantity: Math.max(2, Math.floor(toNumber(tier?.minQuantity))),
      unitPrice: roundMoney(Math.max(0, toNumber(tier?.unitPrice)))
    }))
    .filter((tier) => tier.minQuantity >= 2 && tier.unitPrice > 0)
    .sort((left, right) => left.minQuantity - right.minQuantity);

const ensureNoDuplicateTiers = (tiers: PromotionTierInput[]) => {
  const seen = new Set<number>();
  for (const tier of tiers) {
    if (seen.has(tier.minQuantity)) {
      throw new Error("No se permiten escalas repetidas");
    }
    seen.add(tier.minQuantity);
  }
};

const normalizeDate = (value: unknown, label: string) => {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} no es una fecha valida`);
  }
  return parsed;
};

const scopeIntersects = (left: PromotionScope, right: PromotionScope) =>
  left === "ambos" || right === "ambos" || left === right;

const rangesOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) =>
  startA <= endB && startB <= endA;

const getEffectiveState = (promotion: any, now = new Date()) => {
  if (promotion?.estado === "disabled") return "disabled";
  if (promotion?.estado === "draft") return "draft";
  const start = normalizeDate(promotion?.fecha_inicio, "fecha_inicio");
  const end = normalizeDate(promotion?.fecha_fin, "fecha_fin");
  if (end < now) return "expired";
  if (start > now) return "scheduled";
  return "active";
};

const normalizeVariantRecord = (variantes: any) => {
  if (!variantes) return {};
  if (variantes instanceof Map) return Object.fromEntries(variantes.entries());
  if (typeof variantes?.toObject === "function") return variantes.toObject();
  return Object.fromEntries(
    Object.entries(variantes || {}).map(([key, value]) => [String(key), String(value ?? "").trim()])
  );
};

const getVariantContext = async ({
  sellerId,
  productId,
  variantKey
}: {
  sellerId?: string;
  productId: string;
  variantKey: string;
}) => {
  const match: any = { _id: productId };
  if (sellerId) {
    match.id_vendedor = sellerId;
  }
  const product = await ProductoModel.findOne(match).lean();
  if (!product) {
    throw new Error("Producto no encontrado");
  }

  const rows = (product.sucursales || []).flatMap((branch: any) =>
    (branch.combinaciones || [])
      .filter((combination: any) => {
        const resolvedKey =
          text(combination?.variantKey) ||
          createVariantKey(String(product._id), normalizeVariantRecord(combination?.variantes));
        return resolvedKey === variantKey;
      })
      .map((combination: any) => ({
        price: roundMoney(Math.max(0, toNumber(combination?.precio))),
        stock: Math.max(0, Math.floor(toNumber(combination?.stock))),
        variantLabel: Object.values(normalizeVariantRecord(combination?.variantes))
          .filter(Boolean)
          .join(" / "),
        branchId: String(branch?.id_sucursal || "")
      }))
  );

  if (!rows.length) {
    throw new Error("Variante no encontrada");
  }

  const basePrice = roundMoney(
    rows.reduce((min, row) => (min === 0 ? row.price : Math.min(min, row.price)), 0)
  );

  return {
    product,
    basePrice,
    variantLabel: rows[0]?.variantLabel || product.nombre_producto,
    totalStock: rows.reduce((sum, row) => sum + row.stock, 0)
  };
};

const validatePromotionPayload = async (input: PromotionInput, excludeId?: string) => {
  if (!Types.ObjectId.isValid(input.sellerId)) {
    throw new Error("sellerId invalido");
  }
  if (!Types.ObjectId.isValid(input.productId)) {
    throw new Error("productId invalido");
  }

  const startsAt = normalizeDate(input.startsAt, "fecha_inicio");
  const endsAt = normalizeDate(input.endsAt, "fecha_fin");
  if (endsAt < startsAt) {
    throw new Error("La fecha_fin no puede ser menor a la fecha_inicio");
  }

  const simplePrice =
    input.simplePrice === undefined || input.simplePrice === null
      ? null
      : roundMoney(Math.max(0, toNumber(input.simplePrice)));
  const tiers = normalizeTierList(input.tiers || []);
  ensureNoDuplicateTiers(tiers);

  if (simplePrice === null && tiers.length === 0) {
    throw new Error("Debes definir un precio simple o al menos una escala");
  }
  if (simplePrice !== null && simplePrice <= 0) {
    throw new Error("El precio simple debe ser mayor a 0");
  }

  const context = await getVariantContext({
    sellerId: input.sellerId,
    productId: input.productId,
    variantKey: input.variantKey
  });

  const conflicts = await ProductPromotionModel.find({
    _id: excludeId && Types.ObjectId.isValid(excludeId) ? { $ne: new Types.ObjectId(excludeId) } : { $exists: true },
    id_vendedor: input.sellerId,
    id_producto: input.productId,
    variantKey: input.variantKey,
    estado: { $in: ["active", "draft"] }
  }).lean();

  const overlapping = conflicts.find((promotion: any) => {
    if (!scopeIntersects(promotion.scope, input.scope)) {
      return false;
    }
    return rangesOverlap(
      startsAt,
      endsAt,
      normalizeDate(promotion.fecha_inicio, "fecha_inicio"),
      normalizeDate(promotion.fecha_fin, "fecha_fin")
    );
  });

  if (overlapping) {
    throw new Error("Ya existe una promocion superpuesta para esta variante y canal");
  }

  return {
    startsAt,
    endsAt,
    simplePrice,
    tiers,
    context
  };
};

const mapPromotion = async (promotion: any) => {
  const context = await getVariantContext({
    sellerId: String(promotion.id_vendedor),
    productId: String(promotion.id_producto),
    variantKey: String(promotion.variantKey)
  });

  return {
    id: String(promotion._id),
    sellerId: String(promotion.id_vendedor),
    productId: String(promotion.id_producto),
    productName: String(context.product?.nombre_producto || "Producto"),
    variantKey: String(promotion.variantKey),
    variantLabel: context.variantLabel,
    basePrice: context.basePrice,
    totalStock: context.totalStock,
    scope: promotion.scope,
    title: text(promotion.titulo),
    simplePrice:
      promotion.precio_simple === undefined || promotion.precio_simple === null
        ? null
        : roundMoney(toNumber(promotion.precio_simple)),
    tiers: Array.isArray(promotion.escalas)
      ? promotion.escalas.map((tier: any) => ({
          minQuantity: Math.max(2, Math.floor(toNumber(tier?.minQuantity))),
          unitPrice: roundMoney(toNumber(tier?.unitPrice))
        }))
      : [],
    startsAt: promotion.fecha_inicio,
    endsAt: promotion.fecha_fin,
    state: promotion.estado,
    effectiveState: getEffectiveState(promotion),
    updatedAt: promotion.updatedAt,
    createdAt: promotion.createdAt
  };
};

const getApplicablePromotion = async ({
  productId,
  variantKey,
  scope,
  quantity
}: {
  productId: string;
  variantKey: string;
  scope: PromotionScope;
  quantity: number;
}) => {
  const now = new Date();
  const promotions = await ProductPromotionModel.find({
    id_producto: productId,
    variantKey,
    estado: "active",
    fecha_inicio: { $lte: now },
    fecha_fin: { $gte: now },
    scope: { $in: scope === "ambos" ? ["ambos"] : [scope, "ambos"] }
  })
    .sort({ updatedAt: -1 })
    .lean();

  const promotion = promotions[0];
  if (!promotion) return null;

  const tiers = normalizeTierList(promotion.escalas || []);
  const matchingTier = [...tiers]
    .sort((left, right) => right.minQuantity - left.minQuantity)
    .find((tier) => quantity >= tier.minQuantity);

  return {
    promotion,
    tiers,
    matchingTier
  };
};

const resolveEffectivePricing = async ({
  productId,
  variantKey,
  scope,
  quantity
}: {
  productId: string;
  variantKey: string;
  scope: PromotionScope;
  quantity: number;
}) => {
  const context = await getVariantContext({ productId, variantKey });
  const applied = await getApplicablePromotion({
    productId,
    variantKey,
    scope,
    quantity: Math.max(1, Math.floor(quantity || 1))
  });

  const simplePrice =
    applied?.promotion?.precio_simple === undefined || applied?.promotion?.precio_simple === null
      ? null
      : roundMoney(toNumber(applied?.promotion?.precio_simple));

  const effectivePrice = applied?.matchingTier?.unitPrice ?? simplePrice ?? context.basePrice;
  const discountPercent =
    context.basePrice > 0
      ? roundMoney(((context.basePrice - effectivePrice) / context.basePrice) * 100)
      : 0;

  return {
    productId,
    variantKey,
    variantLabel: context.variantLabel,
    basePrice: context.basePrice,
    effectivePrice: roundMoney(effectivePrice),
    discountPercent: Math.max(0, discountPercent),
    totalStock: context.totalStock,
    appliedPromotionId: applied?.promotion?._id ? String(applied.promotion._id) : null,
    appliedScope: applied?.promotion?.scope || null,
    title: text(applied?.promotion?.titulo),
    simplePrice,
    tiers: applied?.tiers || [],
    matchedTier: applied?.matchingTier || null,
    startsAt: applied?.promotion?.fecha_inicio || null,
    endsAt: applied?.promotion?.fecha_fin || null
  };
};

const createPromotion = async (input: PromotionInput) => {
  const validated = await validatePromotionPayload(input);
  const created = await ProductPromotionModel.create({
    id_vendedor: new Types.ObjectId(input.sellerId),
    id_producto: new Types.ObjectId(input.productId),
    variantKey: input.variantKey,
    scope: input.scope,
    titulo: text(input.title),
    precio_simple: validated.simplePrice,
    escalas: validated.tiers,
    fecha_inicio: validated.startsAt,
    fecha_fin: validated.endsAt,
    estado: input.state || "active"
  });

  return await mapPromotion(created.toObject());
};

const updatePromotion = async (promotionId: string, sellerId: string, input: Partial<PromotionInput>) => {
  const current = await ProductPromotionModel.findOne({
    _id: promotionId,
    id_vendedor: sellerId
  });
  if (!current) {
    throw new Error("Promocion no encontrada");
  }

  const nextPayload: PromotionInput = {
    sellerId,
    productId: text(input.productId || current.id_producto),
    variantKey: text(input.variantKey || current.variantKey),
    scope: (input.scope || current.scope) as PromotionScope,
    title: input.title ?? current.titulo,
    simplePrice:
      input.simplePrice !== undefined ? input.simplePrice : (current as any).precio_simple,
    tiers: input.tiers !== undefined ? input.tiers : ((current as any).escalas || []),
    startsAt: input.startsAt || (current as any).fecha_inicio,
    endsAt: input.endsAt || (current as any).fecha_fin,
    state: (input.state || current.estado) as PromotionState
  };

  const validated = await validatePromotionPayload(nextPayload, promotionId);
  current.id_producto = new Types.ObjectId(nextPayload.productId) as any;
  current.variantKey = nextPayload.variantKey;
  current.scope = nextPayload.scope;
  current.titulo = text(nextPayload.title);
  (current as any).precio_simple = validated.simplePrice;
  (current as any).escalas = validated.tiers;
  (current as any).fecha_inicio = validated.startsAt;
  (current as any).fecha_fin = validated.endsAt;
  current.estado = nextPayload.state || "active";
  await current.save();

  return await mapPromotion(current.toObject());
};

const deletePromotion = async (promotionId: string, sellerId: string) => {
  const deleted = await ProductPromotionModel.findOneAndDelete({
    _id: promotionId,
    id_vendedor: sellerId
  }).lean();
  if (!deleted) {
    throw new Error("Promocion no encontrada");
  }
  return { id: promotionId };
};

const listPromotions = async (params: {
  sellerId: string;
  q?: string;
  scope?: PromotionScope | "all";
  state?: string;
  page?: number;
  limit?: number;
}) => {
  const safePage = Math.max(1, Number(params.page || 1));
  const safeLimit = Math.min(100, Math.max(1, Number(params.limit || 12)));
  const query: any = { id_vendedor: params.sellerId };
  if (params.scope && params.scope !== "all") {
    query.scope = params.scope;
  }
  if (params.state && ["draft", "active", "disabled"].includes(params.state)) {
    query.estado = params.state;
  }

  const promotions = await ProductPromotionModel.find(query)
    .sort({ updatedAt: -1 })
    .lean();

  const mapped = (await Promise.all(promotions.map((promotion) => mapPromotion(promotion)))).filter((item) => {
    const search = text(params.q).toLowerCase();
    if (!search) return true;
    return (
      item.productName.toLowerCase().includes(search) ||
      item.variantLabel.toLowerCase().includes(search) ||
      text(item.title).toLowerCase().includes(search)
    );
  });

  const startIndex = (safePage - 1) * safeLimit;
  const rows = mapped.slice(startIndex, startIndex + safeLimit);
  return {
    rows,
    total: mapped.length,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(mapped.length / safeLimit))
  };
};

const listSellerVariantOptions = async (sellerId: string, q?: string) => {
  const products = await ProductoModel.find({
    id_vendedor: sellerId,
    esTemporal: { $ne: true }
  })
    .select("nombre_producto id_categoria sucursales")
    .lean();

  const grouped = new Map<string, any>();
  for (const product of products as any[]) {
    const productId = String(product._id);
    for (const branch of product.sucursales || []) {
      for (const combination of branch.combinaciones || []) {
        const variants = normalizeVariantRecord(combination?.variantes);
        const variantKey =
          text(combination?.variantKey) || createVariantKey(productId, variants);
        const variantLabel =
          Object.values(variants).filter(Boolean).join(" / ") || product.nombre_producto;
        const key = `${productId}::${variantKey}`;
        const existing = grouped.get(key);
        const nextPrice = roundMoney(Math.max(0, toNumber(combination?.precio)));
        const nextStock = Math.max(0, Math.floor(toNumber(combination?.stock)));
        if (!existing) {
          grouped.set(key, {
            key,
            productId,
            variantKey,
            productName: String(product.nombre_producto || "Producto"),
            variantLabel,
            displayName:
              variantLabel && variantLabel !== product.nombre_producto
                ? `${product.nombre_producto} - ${variantLabel}`
                : String(product.nombre_producto || "Producto"),
            basePrice: nextPrice,
            totalStock: nextStock
          });
        } else {
          existing.basePrice = existing.basePrice === 0 ? nextPrice : Math.min(existing.basePrice, nextPrice);
          existing.totalStock += nextStock;
        }
      }
    }
  }

  const search = text(q).toLowerCase();
  return Array.from(grouped.values())
    .filter((item) =>
      !search ||
      item.displayName.toLowerCase().includes(search) ||
      item.productName.toLowerCase().includes(search)
    )
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "es"));
};

const previewPromotion = async (input: PricingPreviewInput) => {
  const context = await getVariantContext({
    sellerId: input.sellerId,
    productId: input.productId,
    variantKey: input.variantKey
  });
  const tiers = normalizeTierList(input.tiers || []);
  ensureNoDuplicateTiers(tiers);
  const simplePrice =
    input.simplePrice === undefined || input.simplePrice === null
      ? null
      : roundMoney(Math.max(0, toNumber(input.simplePrice)));
  const quantity = Math.max(1, Math.floor(toNumber(input.quantity) || 1));
  const matchedTier = [...tiers]
    .sort((left, right) => right.minQuantity - left.minQuantity)
    .find((tier) => quantity >= tier.minQuantity);
  const effectivePrice = matchedTier?.unitPrice ?? simplePrice ?? context.basePrice;
  const discountPercent =
    context.basePrice > 0
      ? roundMoney(((context.basePrice - effectivePrice) / context.basePrice) * 100)
      : 0;

  return {
    productId: input.productId,
    variantKey: input.variantKey,
    variantLabel: context.variantLabel,
    quantity,
    basePrice: context.basePrice,
    effectivePrice,
    discountPercent: Math.max(0, discountPercent),
    matchedTier: matchedTier || null,
    simplePrice,
    tiers
  };
};

const getCatalogVariantSnapshot = async ({
  productId,
  variantKey
}: {
  productId: string;
  variantKey: string;
}) => {
  const pricing = await resolveEffectivePricing({
    productId,
    variantKey,
    scope: "catalogo",
    quantity: 1
  });

  return {
    basePrice: pricing.basePrice,
    effectivePrice: pricing.effectivePrice,
    discountPercent: pricing.discountPercent,
    promotionLabel: pricing.title || null,
    startsAt: pricing.startsAt,
    endsAt: pricing.endsAt,
    tiers: pricing.tiers
  };
};

export const ProductPromotionService = {
  createPromotion,
  updatePromotion,
  deletePromotion,
  listPromotions,
  listSellerVariantOptions,
  previewPromotion,
  resolveEffectivePricing,
  getCatalogVariantSnapshot
};
