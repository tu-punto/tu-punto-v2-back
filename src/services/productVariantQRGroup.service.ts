import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { IProductoDocument } from "../entities/documents/IProductoDocument";
import {
  IProductVariantQRGroupDocument,
  ProductVariantQRGroupModel
} from "../entities/implements/ProductVariantQRGroupSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { QRService } from "./qr.service";
import { ProductVariantKeyService } from "./productVariantKey.service";
import { variantLabel } from "../utils/variantKey";

type VariantMap = Record<string, string>;

interface GroupItemInput {
  productId: string;
  variantKey: string;
}

interface GroupResolvedItem {
  productId: string;
  productName: string;
  sellerId: string;
  variantKey: string;
  variantLabel: string;
  variantes: VariantMap;
  precio: number;
  stock: number;
  sucursalId?: string;
  status: "available" | "out_of_stock" | "missing_product" | "missing_variant" | "branch_unavailable";
  message?: string;
}

interface GroupDetail {
  id: string;
  name: string;
  sellerId: string;
  groupCode: string;
  qrPayload: string;
  qrImagePath: string;
  active: boolean;
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  items: GroupResolvedItem[];
  updatedAt?: Date;
}

interface ValidatedGroupItem {
  productId: Types.ObjectId;
  variantKey: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
}

const GROUP_QR_PREFIX = "TP|v1|PGRP|";

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

const buildGroupCode = (): string => {
  return `PGRP-${uuidv4().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
};

const buildGroupPayload = (groupCode: string): string => `${GROUP_QR_PREFIX}${groupCode}`;

const uniqueGroupItems = (items: GroupItemInput[]): GroupItemInput[] => {
  const seen = new Set<string>();
  const normalized: GroupItemInput[] = [];

  for (const item of Array.isArray(items) ? items : []) {
    const productId = String(item?.productId || "").trim();
    const variantKey = String(item?.variantKey || "").trim();
    if (!productId || !variantKey) continue;

    const key = `${productId}::${variantKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ productId, variantKey });
  }

  return normalized;
};

const findVariantInProduct = (
  product: IProductoDocument,
  variantKey: string,
  preferredSucursalId?: string,
  strictSucursal = false
): { sucursalId?: string; combinacion?: { variantes: VariantMap; precio: number; stock: number } } | null => {
  const productSucursales = product.sucursales || [];

  if (preferredSucursalId) {
    const preferredSucursal = productSucursales.find(
      (sucursal) => String(sucursal.id_sucursal) === String(preferredSucursalId)
    );
    const preferredCombination = preferredSucursal?.combinaciones?.find(
      (combinacion) => combinacion.variantKey === variantKey
    );

    if (preferredSucursal && preferredCombination) {
      return {
        sucursalId: String(preferredSucursal.id_sucursal),
        combinacion: {
          variantes: toVariantMap(preferredCombination.variantes),
          precio: Number(preferredCombination.precio ?? 0),
          stock: Number(preferredCombination.stock ?? 0)
        }
      };
    }

    if (strictSucursal) {
      return null;
    }
  }

  for (const sucursal of productSucursales) {
    const combinacion = sucursal.combinaciones?.find((item) => item.variantKey === variantKey);
    if (!combinacion) continue;

    return {
      sucursalId: String(sucursal.id_sucursal),
      combinacion: {
        variantes: toVariantMap(combinacion.variantes),
        precio: Number(combinacion.precio ?? 0),
        stock: Number(combinacion.stock ?? 0)
      }
    };
  }

  return null;
};

const validateGroupItems = async (
  sellerId: string,
  items: GroupItemInput[]
): Promise<ValidatedGroupItem[]> => {
  const normalizedItems = uniqueGroupItems(items);
  if (!normalizedItems.length) {
    throw new Error("El grupo debe contener al menos una variante");
  }

  if (!Types.ObjectId.isValid(sellerId)) {
    throw new Error("sellerId inválido");
  }

  const productIds = normalizedItems.map((item) => item.productId);
  const invalidProductId = productIds.find((id) => !Types.ObjectId.isValid(id));
  if (invalidProductId) {
    throw new Error(`productId inválido: ${invalidProductId}`);
  }

  for (const productId of new Set(productIds)) {
    await ProductVariantKeyService.ensureVariantKeysForProductById(productId);
  }

  const products = await ProductoModel.find({
    _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    esTemporal: { $ne: true }
  });

  const productById = new Map<string, IProductoDocument>(
    products.map((product) => [String(product._id), product as IProductoDocument])
  );

  const validatedItems: ValidatedGroupItem[] = [];

  for (const item of normalizedItems) {
    const product = productById.get(String(item.productId));
    if (!product) {
      throw new Error(`Producto no encontrado para item ${item.productId}`);
    }

    if (String(product.id_vendedor) !== String(sellerId)) {
      throw new Error(`El producto ${product.nombre_producto} no pertenece al vendedor seleccionado`);
    }

    const variantFound = findVariantInProduct(product, item.variantKey);
    if (!variantFound?.combinacion) {
      throw new Error(`Variante no encontrada en producto ${product.nombre_producto}`);
    }

    validatedItems.push({
      productId: new Types.ObjectId(String(product._id)),
      variantKey: item.variantKey,
      productNameSnapshot: product.nombre_producto,
      variantLabelSnapshot: variantLabel(variantFound.combinacion.variantes)
    });
  }

  return validatedItems;
};

const resolveGroupItems = async (
  group: IProductVariantQRGroupDocument,
  preferredSucursalId?: string
): Promise<GroupResolvedItem[]> => {
  const productIds = Array.from(new Set(group.items.map((item) => String(item.productId))))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const products = await ProductoModel.find({ _id: { $in: productIds }, esTemporal: { $ne: true } });
  const productById = new Map<string, IProductoDocument>(
    products.map((product) => [String(product._id), product as IProductoDocument])
  );

  return group.items.map((item) => {
    const product = productById.get(String(item.productId));
    if (!product) {
      return {
        productId: String(item.productId),
        productName: item.productNameSnapshot,
        sellerId: String(group.sellerId),
        variantKey: item.variantKey,
        variantLabel: item.variantLabelSnapshot,
        variantes: {},
        precio: 0,
        stock: 0,
        status: "missing_product",
        message: "Producto ya no disponible"
      };
    }

    const variantFound = findVariantInProduct(product, item.variantKey, preferredSucursalId, Boolean(preferredSucursalId));
    if (!variantFound?.combinacion) {
      return {
        productId: String(product._id),
        productName: product.nombre_producto,
        sellerId: String(product.id_vendedor),
        variantKey: item.variantKey,
        variantLabel: item.variantLabelSnapshot,
        variantes: {},
        precio: 0,
        stock: 0,
        status: preferredSucursalId ? "branch_unavailable" : "missing_variant",
        message: preferredSucursalId
          ? "Variante no disponible en la sucursal actual"
          : "Variante ya no disponible"
      };
    }

    const resolvedItem: GroupResolvedItem = {
      productId: String(product._id),
      productName: product.nombre_producto,
      sellerId: String(product.id_vendedor),
      variantKey: item.variantKey,
      variantLabel: variantLabel(variantFound.combinacion.variantes),
      variantes: variantFound.combinacion.variantes,
      precio: variantFound.combinacion.precio,
      stock: variantFound.combinacion.stock,
      sucursalId: variantFound.sucursalId
    } as GroupResolvedItem;

    if (variantFound.combinacion.stock > 0) {
      resolvedItem.status = "available";
      return resolvedItem;
    }

    resolvedItem.status = "out_of_stock";
    resolvedItem.message = "Sin stock en la sucursal actual";
    return resolvedItem;
  });
};

const toGroupDetail = async (
  group: IProductVariantQRGroupDocument,
  preferredSucursalId?: string
): Promise<GroupDetail> => {
  const items = await resolveGroupItems(group, preferredSucursalId);
  const availableItems = items.filter((item) => item.status === "available").length;

  return {
    id: String(group._id),
    name: group.name,
    sellerId: String(group.sellerId),
    groupCode: group.groupCode,
    qrPayload: group.qrPayload,
    qrImagePath: group.qrImagePath || "",
    active: group.active,
    totalItems: items.length,
    availableItems,
    unavailableItems: items.length - availableItems,
    items,
    updatedAt: group.updatedAt
  };
};

const createGroup = async (params: {
  name: string;
  sellerId: string;
  items: GroupItemInput[];
}): Promise<GroupDetail> => {
  const name = String(params.name || "").trim();
  if (!name) {
    throw new Error("name es requerido");
  }

  const validatedItems = await validateGroupItems(params.sellerId, params.items);
  const groupCode = buildGroupCode();

  const group = await ProductVariantQRGroupModel.create({
    name,
    sellerId: new Types.ObjectId(params.sellerId),
    groupCode,
    qrPayload: buildGroupPayload(groupCode),
    items: validatedItems,
    active: true
  });

  return toGroupDetail(group);
};

const updateGroup = async (params: {
  id: string;
  name?: string;
  items?: GroupItemInput[];
  active?: boolean;
}): Promise<GroupDetail> => {
  if (!Types.ObjectId.isValid(params.id)) {
    throw new Error("id inválido");
  }

  const group = await ProductVariantQRGroupModel.findById(params.id);
  if (!group) {
    throw new Error("Grupo QR no encontrado");
  }

  if (params.name !== undefined) {
    const name = String(params.name || "").trim();
    if (!name) {
      throw new Error("name no puede estar vacío");
    }
    group.name = name;
  }

  if (params.items !== undefined) {
    const validatedItems = await validateGroupItems(String(group.sellerId), params.items);
    group.items = validatedItems;
  }

  if (typeof params.active === "boolean") {
    group.active = params.active;
  }

  await group.save();
  return toGroupDetail(group);
};

const getGroupById = async (
  id: string,
  preferredSucursalId?: string
): Promise<GroupDetail> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("id inválido");
  }

  const group = await ProductVariantQRGroupModel.findById(id);
  if (!group) {
    throw new Error("Grupo QR no encontrado");
  }

  return toGroupDetail(group, preferredSucursalId);
};

const listGroups = async (params?: {
  sellerId?: string;
  q?: string;
  active?: boolean;
  limit?: number;
}): Promise<{
  count: number;
  items: Array<{
    id: string;
    name: string;
    sellerId: string;
    groupCode: string;
    qrImagePath: string;
    active: boolean;
    totalItems: number;
    previewItems: Array<{
      productId: string;
      variantKey: string;
      productName: string;
      variantLabel: string;
    }>;
    updatedAt?: Date;
  }>;
}> => {
  const query: Record<string, unknown> = {};
  if (params?.sellerId) {
    if (!Types.ObjectId.isValid(params.sellerId)) {
      throw new Error("sellerId inválido");
    }
    query.sellerId = new Types.ObjectId(params.sellerId);
  }

  if (typeof params?.active === "boolean") {
    query.active = params.active;
  }

  if (params?.q?.trim()) {
    query.$or = [
      { name: { $regex: params.q.trim(), $options: "i" } },
      { groupCode: { $regex: params.q.trim(), $options: "i" } }
    ];
  }

  const safeLimit = Math.max(1, Math.min(Number(params?.limit) || 100, 300));
  const [count, groups] = await Promise.all([
    ProductVariantQRGroupModel.countDocuments(query),
    ProductVariantQRGroupModel.find(query).sort({ updatedAt: -1 }).limit(safeLimit)
  ]);

  return {
    count,
    items: groups.map((group) => ({
      id: String(group._id),
      name: group.name,
      sellerId: String(group.sellerId),
      groupCode: group.groupCode,
      qrImagePath: group.qrImagePath || "",
      active: group.active,
      totalItems: group.items.length,
      previewItems: group.items.slice(0, 5).map((item) => ({
        productId: String(item.productId),
        variantKey: item.variantKey,
        productName: item.productNameSnapshot,
        variantLabel: item.variantLabelSnapshot
      })),
      updatedAt: group.updatedAt
    }))
  };
};

const generateGroupQR = async (params: {
  id: string;
  forceRegenerate?: boolean;
}): Promise<{
  id: string;
  name: string;
  groupCode: string;
  qrPayload: string;
  qrImagePath: string;
  active: boolean;
}> => {
  if (!Types.ObjectId.isValid(params.id)) {
    throw new Error("id inválido");
  }

  const group = await ProductVariantQRGroupModel.findById(params.id);
  if (!group) {
    throw new Error("Grupo QR no encontrado");
  }

  if (!group.qrPayload) {
    group.groupCode = group.groupCode || buildGroupCode();
    group.qrPayload = buildGroupPayload(group.groupCode);
  }

  if (!group.qrImagePath || params.forceRegenerate) {
    const { qrPath } = await QRService.generatePayloadQRToS3(
      group.qrPayload,
      `group-${String(group._id)}`
    );
    group.qrImagePath = qrPath;
    await group.save();
  }

  return {
    id: String(group._id),
    name: group.name,
    groupCode: group.groupCode,
    qrPayload: group.qrPayload,
    qrImagePath: group.qrImagePath,
    active: group.active
  };
};

const extractGroupCodeFromPayload = (payload: string): string | null => {
  const value = String(payload || "").trim();
  if (!value) return null;

  const parts = value.split("|");
  if (parts.length === 4 && parts[0] === "TP" && parts[1] === "v1" && parts[2] === "PGRP") {
    return parts[3];
  }

  return value.startsWith("PGRP-") ? value : null;
};

const resolveGroupQRPayload = async (
  payload: string,
  preferredSucursalId?: string
): Promise<(GroupDetail & { type: "group" }) | null> => {
  const code = extractGroupCodeFromPayload(payload);
  if (!code) return null;

  const group = await ProductVariantQRGroupModel.findOne({
    groupCode: code,
    active: true
  });
  if (!group) return null;

  const detail = await toGroupDetail(group, preferredSucursalId);
  return {
    ...detail,
    type: "group"
  };
};

export const ProductVariantQRGroupService = {
  createGroup,
  updateGroup,
  getGroupById,
  listGroups,
  generateGroupQR,
  resolveGroupQRPayload
};
