import { ProductoModel } from '../entities/implements/ProductoSchema';
import { IVentaDocument } from '../entities/documents/IVentaDocument';
import { IProducto } from '../entities/IProducto';
import { IProductoDocument } from '../entities/documents/IProductoDocument';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { createVariantKey } from '../utils/variantKey';

const findAll = async (): Promise<IProductoDocument[]> => {
  return await ProductoModel.find({ esTemporal: { $ne: true } }) // excluye temporales
    .populate('features')
    .populate('categoria')
    .populate('group')
    .exec();
};
const findAllTemporales = async (): Promise<IProductoDocument[]> => {
  return await ProductoModel.find({ esTemporal: true }) // solo temporales
    .populate('features')
    .populate('categoria')
    .populate('group')
    .exec();
};


const findById = async (productoId: string): Promise<IProductoDocument | null> => {
  return await ProductoModel.findById(productoId).exec();
};

// Buscar producto por código QR
const findByQRCode = async (qrCode: string): Promise<IProductoDocument | null> => {
  return await ProductoModel.findOne({ qrCode })
    .populate('features')
    .populate('categoria')
    .populate('group')
    .exec();
};

const findBySellerId = async (sellerId: string): Promise<IProductoDocument[]> => {
  return await ProductoModel.find({ id_vendedor: sellerId }).populate('ingreso').exec();
};

const registerProduct = async (product: IProducto): Promise<IProductoDocument> => {
  console.log("🛠 Intentando registrar producto en Mongo:", product);

  if (product._id && !mongoose.isValidObjectId(product._id)) {
    console.warn("⚠️ _id inválido recibido, eliminando del objeto");
    delete product._id;
  }

  try {
    const newProduct = new ProductoModel(product);
    const saved = await newProduct.save();
    console.log("✅ Producto guardado correctamente en Mongo");
    return saved;
  } catch (err: any) {
    console.error("❌ Error al guardar producto en Mongo:", err?.message || err);
    throw err;
  }
};

const getProductsBySales = async (sales: IVentaDocument[]) => {
  const productIds = sales.map(sale => sale.producto);
  return await ProductoModel.find({ _id: { $in: productIds } }).exec();
};

const getStockForSucursal = async (productId: string, sucursalId: string) => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) return null;
  return producto.sucursales.find(s => s.id_sucursal.equals(sucursalId)) || null;
};

const updateStockInSucursal = async (
  productId: string,
  sucursalId: string,
  varianteNombre: string,
  nuevoStock: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  // Recorremos las combinaciones para encontrar una que tenga esa variante
  const combinacion = sucursal.combinaciones?.find(c => c.variantes?.[varianteNombre] !== undefined);
  if (!combinacion) throw new Error("No se encontró una combinación con esa variante");

  combinacion.stock = nuevoStock;
  return await producto.save();
};

const updatePriceInSucursal = async (
  productId: string,
  params: {
    variantKey?: string;
    variantes?: Record<string, string>;
    precio: number;
  }
): Promise<{ product: IProductoDocument; updatedBranches: number }> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const normalizedInputVariants = Object.fromEntries(
    Object.entries(params.variantes || {}).map(([key, value]) => [
      String(key).trim(),
      String(value ?? "").trim()
    ])
  );

  const matchesVariant = (candidate: Record<string, string> | Map<string, string>) => {
    const variantesPlanas = Object.fromEntries(
      candidate instanceof Map ? candidate : Object.entries(candidate || {})
    );
    const combKeys = Object.keys(variantesPlanas);
    const inputKeys = Object.keys(normalizedInputVariants);

    if (combKeys.length !== inputKeys.length) return false;

    return inputKeys.every(key =>
      String(variantesPlanas[key] || "").trim().toLowerCase() ===
      String(normalizedInputVariants[key] || "").trim().toLowerCase()
    );
  };

  let updatedBranches = 0;

  for (const sucursal of producto.sucursales || []) {
    const combinacion = sucursal.combinaciones.find((item) => {
      if (params.variantKey && item.variantKey) {
        return item.variantKey === params.variantKey;
      }

      if (params.variantKey && !item.variantKey) {
        return createVariantKey(productId, item.variantes) === params.variantKey;
      }

      if (!Object.keys(normalizedInputVariants).length) {
        return false;
      }

      return matchesVariant(item.variantes);
    });

    if (!combinacion) continue;

    combinacion.precio = params.precio;
    updatedBranches += 1;
  }

  if (!updatedBranches) {
    throw new Error("No se encontró la variante para actualizar el precio");
  }

  producto.markModified("sucursales");
  const savedProduct = await producto.save();
  return {
    product: savedProduct,
    updatedBranches
  };
};


const updateStockOfSubvariant = async (
  productId: string,
  sucursalId: string,
  varianteNombre: string,
  subvarianteNombre: string,
  nuevoStock: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  const combinacion = sucursal.combinaciones?.find(c =>
    c.variantes?.[varianteNombre] === subvarianteNombre
  );

  if (!combinacion) throw new Error("No se encontró la combinación para esa subvariante");

  combinacion.stock = nuevoStock;
  return await producto.save();
};

const getAllStockByProductId = async (productId: string) => {
  return await ProductoModel.findById(productId).select('sucursales');
};
const updateStockByVariantCombination = async (
  productId: string,
  sucursalId: string,
  variantes: Record<string, string>,
  nuevoStock: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s =>
    s.id_sucursal.toString() === sucursalId.toString()
  );
  if (!sucursal) throw new Error("Sucursal no encontrada");

  //console.log("🛠 Entrando a updateStockByVariantCombination:");
  //console.log("▶ Input variantes:", variantes);

  sucursal.combinaciones.forEach((c, i) => {
    console.log(`🧪 Combinación #${i + 1}:`, c.variantes);
  });
  const combinacion = sucursal.combinaciones.find((c, index) => {
    const variantesPlanas = Object.fromEntries(c.variantes instanceof Map ? c.variantes : Object.entries(c.variantes || {}));
    const combKeys = Object.keys(variantesPlanas);
    const inputKeys = Object.keys(variantes);

    if (combKeys.length !== inputKeys.length) {
      return false;
    }

    const match = inputKeys.every(key => {
      const combVal = variantesPlanas[key]?.toLowerCase?.();
      const inputVal = variantes[key]?.toLowerCase?.();
      return combVal === inputVal;
    });

    if (match) console.log(`¡MATCH encontrado con combinación #${index + 1}!`);
    return match;
  });

  if (!combinacion) {
    console.error("❌ No se encontró la combinación correspondiente.");
    throw new Error("No se encontró la combinación");
  }

  console.log(`Actualizando stock a: ${nuevoStock}`);
  combinacion.stock = nuevoStock;

  return await producto.save();
};
const addVariantToProduct = async (
  productId: string,
  sucursalId: string,
  combinaciones: {
    variantes: Record<string, string>,
    precio: number,
    stock: number
  }[]
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  for (const nueva of combinaciones) {
    const yaExiste = sucursal.combinaciones.some(c =>
      Object.keys(c.variantes).length === Object.keys(nueva.variantes).length &&
      Object.keys(nueva.variantes).every(
        key => c.variantes[key]?.toLowerCase?.() === nueva.variantes[key]?.toLowerCase?.()
      )
    );
    if (!yaExiste) {
      sucursal.combinaciones.push({
        ...nueva,
        variantKey: (nueva as any).variantKey || createVariantKey(productId, nueva.variantes)
      });
    }
  }

  return await producto.save();
};
type FlatInventoryParams = {
  sucursalId?: string;
  sellerId?: string;
  sellerIds?: string[];
  categoryId?: string;
  inStock?: boolean;
  q?: string;
};

type FlatInventoryPageParams = FlatInventoryParams & {
  page?: number;
  limit?: number;
};

type SellerProductInfoParams = {
  sellerId: string;
  sucursalId?: string;
  categoryId?: string;
  inStock?: boolean;
  hasPromotion?: boolean;
  hasImages?: boolean;
  hasDescription?: boolean;
  q?: string;
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
};

type SellerProductInfoStatusSummary = {
  sellerId: string;
  totalVariants: number;
  emptyCount: number;
  partialCount: number;
  completeCount: number;
  productInfoStatus: "empty" | "partial" | "complete";
};

type SuperadminVariantInventoryParams = {
  sellerId: string;
  q?: string;
  inStock?: boolean;
  page?: number;
  limit?: number;
  sortOrder?: "asc" | "desc";
};

const normalizeVariantRecord = (variantes: Record<string, string> | Map<string, string> | undefined | null) => {
  const sourceEntries =
    variantes instanceof Map ? Array.from(variantes.entries()) : Object.entries(variantes || {});

  return Object.fromEntries(
    sourceEntries.map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
  );
};

const variantMatchesKey = (
  productId: string,
  combinacion: { variantKey?: string; variantes: Record<string, string> | Map<string, string> },
  targetVariantKey: string
) => {
  if (combinacion.variantKey && combinacion.variantKey === targetVariantKey) {
    return true;
  }

  return createVariantKey(productId, normalizeVariantRecord(combinacion.variantes)) === targetVariantKey;
};

const variantRecordsEqual = (
  left: Record<string, string> | Map<string, string> | undefined | null,
  right: Record<string, string> | Map<string, string> | undefined | null
) => {
  const normalizedLeft = normalizeVariantRecord(left);
  const normalizedRight = normalizeVariantRecord(right);

  const leftKeys = Object.keys(normalizedLeft);
  const rightKeys = Object.keys(normalizedRight);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key) =>
      normalizedRight[key] !== undefined &&
      normalizedLeft[key].toLowerCase() === normalizedRight[key].toLowerCase()
  );
};

const buildFlatProductPipeline = (params?: FlatInventoryParams): any[] => {
  const sucursalId = params?.sucursalId;
  const sellerId = params?.sellerId;
  const sellerIds = Array.isArray(params?.sellerIds) ? params?.sellerIds : [];
  const categoryId = params?.categoryId;
  const inStock = params?.inStock;
  const q = params?.q;
  console.log("📦 findFlatProductList filtros:", {
    sucursalId,
    sellerId,
    sellerIdsCount: sellerIds.length,
    categoryId,
    inStock,
    q
  });

  const match: any = { esTemporal: { $ne: true } };
  if (sellerId && Types.ObjectId.isValid(sellerId)) {
    match.id_vendedor = new Types.ObjectId(sellerId);
  } else if (sellerIds.length > 0) {
    const validSellerIds = sellerIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (validSellerIds.length > 0) {
      match.id_vendedor = { $in: validSellerIds };
    }
  }
  if (categoryId && Types.ObjectId.isValid(categoryId)) {
    match.id_categoria = new Types.ObjectId(categoryId);
  }

  const pipeline: any[] = [{ $match: match }, { $unwind: "$sucursales" }];

  if (sucursalId && Types.ObjectId.isValid(sucursalId)) {
    pipeline.push({
      $match: {
        "sucursales.id_sucursal": new Types.ObjectId(sucursalId)
      }
    });
  } else if (sucursalId) {
    console.warn("⚠️ sucursalId inválido recibido en findFlatProductList:", sucursalId);
  }

  pipeline.push(
    { $unwind: "$sucursales.combinaciones" },
    ...(inStock ? [{ $match: { "sucursales.combinaciones.stock": { $gt: 0 } } }] : []),
    {
      $lookup: {
        from: "Categoria",
        localField: "id_categoria",
        foreignField: "_id",
        as: "categoria_info"
      }
    },
    {
      $lookup: {
        from: "Vendedor",
        localField: "id_vendedor",
        foreignField: "_id",
        as: "vendedor_info"
      }
    },
    {
      $project: {
        _id: 1,
        nombre_producto: 1,
        variante: {
          $reduce: {
            input: { $objectToArray: "$sucursales.combinaciones.variantes" },
            initialValue: "",
            in: {
              $cond: [
                { $eq: ["$$value", ""] },
                "$$this.v",
                { $concat: ["$$value", " / ", "$$this.v"] }
              ]
            }
          }
        },
        variantes_obj: "$sucursales.combinaciones.variantes",
        precio: "$sucursales.combinaciones.precio",
        stock: "$sucursales.combinaciones.stock",
        sucursalId: "$sucursales.id_sucursal",
        categoria: { $arrayElemAt: ["$categoria_info.categoria", 0] },
        id_categoria: "$id_categoria",
        id_vendedor: "$id_vendedor",
        vendedor: {
          $concat: [
            { $arrayElemAt: ["$vendedor_info.nombre", 0] },
            " ",
            { $arrayElemAt: ["$vendedor_info.apellido", 0] }
          ]
        },
        qrCode: "$qrCode",
        qrImagePath: "$qrImagePath",
        qrProductURL: "$qrProductURL",
        variantKey: "$sucursales.combinaciones.variantKey",

        imagenes: "$sucursales.combinaciones.imagenes",
        descripcion: "$sucursales.combinaciones.descripcion",
        promocion: "$sucursales.combinaciones.promocion"
      }
    }
  );

  if (q && q.trim()) {
    pipeline.push({
      $match: {
        $or: [
          { nombre_producto: { $regex: q.trim(), $options: "i" } },
          { variante: { $regex: q.trim(), $options: "i" } }
        ]
      }
    });
  }

  return pipeline;
};

const findFlatProductList = async (params?: FlatInventoryParams) => {
  const pipeline = buildFlatProductPipeline(params);
  return await ProductoModel.aggregate(pipeline);
};

const findFlatProductListPage = async (params?: FlatInventoryPageParams) => {
  const safePage = Math.max(1, Number(params?.page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(params?.limit) || 10));
  const pipeline = buildFlatProductPipeline(params);

  const result = await ProductoModel.aggregate([
    ...pipeline,
    { $sort: { nombre_producto: 1, _id: 1 } },
    {
      $facet: {
        rows: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
        total: [{ $count: "count" }]
      }
    }
  ]);

  const rows = result?.[0]?.rows || [];
  const total = Number(result?.[0]?.total?.[0]?.count || 0);
  return {
    rows,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit))
  };
};

const buildSellerProductInfoPipeline = (params: SellerProductInfoParams): any[] => {
  const {
    sellerId,
    sucursalId,
    categoryId,
    inStock,
    hasPromotion,
    hasImages,
    hasDescription,
    q
  } = params;

  const match: any = {
    esTemporal: { $ne: true },
    id_vendedor: new Types.ObjectId(sellerId)
  };

  if (categoryId && Types.ObjectId.isValid(categoryId)) {
    match.id_categoria = new Types.ObjectId(categoryId);
  }

  const variantLabelExpression = {
    $reduce: {
      input: { $objectToArray: "$sucursales.combinaciones.variantes" },
      initialValue: "",
      in: {
        $cond: [
          { $eq: ["$$value", ""] },
          "$$this.v",
          { $concat: ["$$value", " / ", "$$this.v"] }
        ]
      }
    }
  };

  const pipeline: any[] = [
    { $match: match },
    { $unwind: "$sucursales" }
  ];

  if (sucursalId && Types.ObjectId.isValid(sucursalId)) {
    pipeline.push({
      $match: {
        "sucursales.id_sucursal": new Types.ObjectId(sucursalId)
      }
    });
  }

  pipeline.push(
    { $unwind: "$sucursales.combinaciones" },
    {
      $addFields: {
        _variantLabel: variantLabelExpression,
        _descriptionNormalized: {
          $trim: { input: { $ifNull: ["$sucursales.combinaciones.descripcion", ""] } }
        },
        _usageNormalized: {
          $trim: { input: { $ifNull: ["$sucursales.combinaciones.uso", ""] } }
        },
        _promotionTitleNormalized: {
          $trim: { input: { $ifNull: ["$sucursales.combinaciones.promocion.titulo", ""] } }
        },
        _promotionDescriptionNormalized: {
          $trim: {
            input: { $ifNull: ["$sucursales.combinaciones.promocion.descripcion", ""] }
          }
        },
        _promotionStartNormalized: {
          $ifNull: ["$sucursales.combinaciones.promocion.fechaInicio", null]
        },
        _promotionEndNormalized: {
          $ifNull: ["$sucursales.combinaciones.promocion.fechaFin", null]
        },
        _imagesNormalized: { $ifNull: ["$sucursales.combinaciones.imagenes", []] }
      }
    },
    {
      $addFields: {
        _hasDescription: { $gt: [{ $strLenCP: "$_descriptionNormalized" }, 0] },
        _hasUsage: { $gt: [{ $strLenCP: "$_usageNormalized" }, 0] },
        _hasPromotion: {
          $or: [
            { $gt: [{ $strLenCP: "$_promotionTitleNormalized" }, 0] },
            { $gt: [{ $strLenCP: "$_promotionDescriptionNormalized" }, 0] },
            { $ne: ["$_promotionStartNormalized", null] },
            { $ne: ["$_promotionEndNormalized", null] }
          ]
        },
        _hasImages: { $gt: [{ $size: "$_imagesNormalized" }, 0] },
        _displayName: {
          $cond: [
            { $gt: [{ $strLenCP: "$_variantLabel" }, 0] },
            { $concat: ["$nombre_producto", " - ", "$_variantLabel"] },
            "$nombre_producto"
          ]
        }
      }
    }
  );

  if (q && q.trim()) {
    pipeline.push({
        $match: {
          $or: [
            { nombre_producto: { $regex: q.trim(), $options: "i" } },
            { _variantLabel: { $regex: q.trim(), $options: "i" } },
            { _displayName: { $regex: q.trim(), $options: "i" } },
            { _descriptionNormalized: { $regex: q.trim(), $options: "i" } },
            { _usageNormalized: { $regex: q.trim(), $options: "i" } },
            { _promotionTitleNormalized: { $regex: q.trim(), $options: "i" } },
            { _promotionDescriptionNormalized: { $regex: q.trim(), $options: "i" } }
          ]
        }
    });
  }

  pipeline.push(
    {
      $sort: {
        _hasDescription: -1,
        _hasUsage: -1,
        _hasPromotion: -1,
        _hasImages: -1,
        "sucursales.combinaciones.stock": -1
      }
    },
    {
      $group: {
        _id: {
          productId: "$_id",
          variantKey: {
            $ifNull: ["$sucursales.combinaciones.variantKey", "$_variantLabel"]
          }
        },
        productId: { $first: "$_id" },
        variantKey: { $first: "$sucursales.combinaciones.variantKey" },
        nombreProducto: { $first: "$nombre_producto" },
        variantLabel: { $first: "$_variantLabel" },
        displayName: { $first: "$_displayName" },
        variantes: { $first: "$sucursales.combinaciones.variantes" },
        descripcion: { $first: "$_descriptionNormalized" },
        uso: { $first: "$_usageNormalized" },
        imagenes: { $first: "$_imagesNormalized" },
        promocion: { $first: "$sucursales.combinaciones.promocion" },
        categoryId: { $first: "$id_categoria" },
        sellerId: { $first: "$id_vendedor" },
        representativeSucursalId: { $first: "$sucursales.id_sucursal" },
        sucursalIds: { $addToSet: "$sucursales.id_sucursal" },
        totalStock: { $sum: "$sucursales.combinaciones.stock" }
      }
    },
    {
      $addFields: {
        hasDescription: { $gt: [{ $strLenCP: "$descripcion" }, 0] },
        hasUsage: { $gt: [{ $strLenCP: "$uso" }, 0] },
        hasImages: { $gt: [{ $size: "$imagenes" }, 0] },
        hasPromotion: {
          $or: [
            { $gt: [{ $strLenCP: { $ifNull: ["$promocion.titulo", ""] } }, 0] },
            { $gt: [{ $strLenCP: { $ifNull: ["$promocion.descripcion", ""] } }, 0] },
            { $ne: [{ $ifNull: ["$promocion.fechaInicio", null] }, null] },
            { $ne: [{ $ifNull: ["$promocion.fechaFin", null] }, null] }
          ]
        },
        displayNameSortable: { $toLower: "$displayName" }
      }
    }
  );

  if (inStock !== undefined) {
    pipeline.push({
      $match: {
        totalStock: inStock ? { $gt: 0 } : { $lte: 0 }
      }
    });
  }

  if (hasPromotion !== undefined) {
    pipeline.push({ $match: { hasPromotion } });
  }

  if (hasImages !== undefined) {
    pipeline.push({ $match: { hasImages } });
  }

  if (hasDescription !== undefined) {
    pipeline.push({ $match: { hasDescription } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "Categoria",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoria_info"
      }
    },
    {
      $project: {
        _id: 0,
        productId: 1,
        sellerId: 1,
        categoryId: 1,
        categoryName: { $arrayElemAt: ["$categoria_info.categoria", 0] },
        variantKey: 1,
        variantLabel: 1,
        displayName: 1,
        displayNameSortable: 1,
        nombreProducto: 1,
        variantes: 1,
        descripcion: {
          $cond: [{ $eq: ["$descripcion", ""] }, null, "$descripcion"]
        },
        uso: {
          $cond: [{ $eq: ["$uso", ""] }, null, "$uso"]
        },
        imagenes: 1,
        imagenesCount: { $size: "$imagenes" },
        hasImages: 1,
        hasDescription: 1,
        hasUsage: 1,
        hasPromotion: 1,
        promocion: {
          titulo: { $ifNull: ["$promocion.titulo", null] },
          descripcion: { $ifNull: ["$promocion.descripcion", null] },
          fechaInicio: { $ifNull: ["$promocion.fechaInicio", null] },
          fechaFin: { $ifNull: ["$promocion.fechaFin", null] }
        },
        promocionTitulo: { $ifNull: ["$promocion.titulo", null] },
        promocionDescripcion: { $ifNull: ["$promocion.descripcion", null] },
        promocionFechaInicio: { $ifNull: ["$promocion.fechaInicio", null] },
        promocionFechaFin: { $ifNull: ["$promocion.fechaFin", null] },
        totalStock: 1,
        representativeSucursalId: 1,
        sucursalIds: 1
      }
    }
  );

  return pipeline;
};

const findSellerProductInfoListPage = async (params: SellerProductInfoParams) => {
  const safePage = Math.max(1, Number(params.page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(params.limit) || 10));
  const sortDirection = params.sortOrder === "desc" ? -1 : 1;
  const pipeline = buildSellerProductInfoPipeline(params);

  const result = await ProductoModel.aggregate([
    ...pipeline,
    { $sort: { displayNameSortable: sortDirection, productId: 1 } },
    {
      $facet: {
        rows: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
        total: [{ $count: "count" }]
      }
    }
  ]);

  const rows = (result?.[0]?.rows || []).map((row: any) => {
    const { displayNameSortable, ...rest } = row;
    return rest;
  });
  const total = Number(result?.[0]?.total?.[0]?.count || 0);

  return {
    rows,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit))
  };
};

const findSuperadminVariantInventoryPage = async (params: SuperadminVariantInventoryParams) => {
  const safePage = Math.max(1, Number(params.page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const sortDirection = params.sortOrder === "desc" ? -1 : 1;
  const search = String(params.q || "").trim();

  const variantLabelExpression = {
    $reduce: {
      input: { $objectToArray: "$sucursales.combinaciones.variantes" },
      initialValue: "",
      in: {
        $cond: [
          { $eq: ["$$value", ""] },
          "$$this.v",
          { $concat: ["$$value", " / ", "$$this.v"] }
        ]
      }
    }
  };

  const pipeline: any[] = [
    {
      $match: {
        esTemporal: { $ne: true },
        id_vendedor: new Types.ObjectId(params.sellerId)
      }
    },
    { $unwind: "$sucursales" },
    { $unwind: "$sucursales.combinaciones" },
    {
      $addFields: {
        _variantLabel: variantLabelExpression,
        _resolvedVariantKey: {
          $ifNull: ["$sucursales.combinaciones.variantKey", variantLabelExpression]
        },
        _displayName: {
          $cond: [
            { $gt: [{ $strLenCP: variantLabelExpression }, 0] },
            { $concat: ["$nombre_producto", " - ", variantLabelExpression] },
            "$nombre_producto"
          ]
        }
      }
    }
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { nombre_producto: { $regex: search, $options: "i" } },
          { _variantLabel: { $regex: search, $options: "i" } },
          { _displayName: { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  pipeline.push(
    {
      $group: {
        _id: {
          productId: "$_id",
          variantKey: "$_resolvedVariantKey"
        },
        productId: { $first: { $toString: "$_id" } },
        productName: { $first: "$nombre_producto" },
        variantKey: { $first: "$_resolvedVariantKey" },
        variantLabel: { $first: "$_variantLabel" },
        displayName: { $first: "$_displayName" },
        variantAttributes: { $first: "$sucursales.combinaciones.variantes" },
        categoryId: { $first: "$id_categoria" },
        totalStock: { $sum: "$sucursales.combinaciones.stock" },
        branchStocks: {
          $push: {
            sucursalId: { $toString: "$sucursales.id_sucursal" },
            stock: "$sucursales.combinaciones.stock"
          }
        }
      }
    }
  );

  if (params.inStock !== undefined) {
    pipeline.push({
      $match: {
        totalStock: params.inStock ? { $gt: 0 } : { $lte: 0 }
      }
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "Categoria",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoria_info"
      }
    },
    {
      $addFields: {
        displayNameSortable: { $toLower: "$displayName" },
        categoryName: { $arrayElemAt: ["$categoria_info.categoria", 0] }
      }
    }
  );

  const result = await ProductoModel.aggregate([
    ...pipeline,
    { $sort: { displayNameSortable: sortDirection, productId: 1 } },
    {
      $facet: {
        rows: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
        total: [{ $count: "count" }]
      }
    }
  ]);

  const rows = (result?.[0]?.rows || []).map((row: any) => ({
    productId: String(row.productId),
    productName: String(row.productName || ""),
    variantKey: String(row.variantKey || ""),
    variantLabel: String(row.variantLabel || ""),
    displayName: String(row.displayName || row.productName || ""),
    variantAttributes: normalizeVariantRecord(row.variantAttributes),
    categoryName: row.categoryName ? String(row.categoryName) : null,
    totalStock: Number(row.totalStock || 0),
    branchStocks: Array.isArray(row.branchStocks)
      ? row.branchStocks.map((branch: any) => ({
          sucursalId: String(branch?.sucursalId || ""),
          stock: Number(branch?.stock || 0)
        }))
      : []
  }));
  const total = Number(result?.[0]?.total?.[0]?.count || 0);

  return {
    rows,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit))
  };
};

const findSellerProductInfoStatusBySellerIds = async (
  sellerIds: string[]
): Promise<SellerProductInfoStatusSummary[]> => {
  const validSellerIds = sellerIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validSellerIds.length === 0) {
    return [];
  }

  const variantLabelExpression = {
    $reduce: {
      input: { $objectToArray: "$sucursales.combinaciones.variantes" },
      initialValue: "",
      in: {
        $cond: [
          { $eq: ["$$value", ""] },
          "$$this.v",
          { $concat: ["$$value", " / ", "$$this.v"] }
        ]
      }
    }
  };

  const result = await ProductoModel.aggregate([
    {
      $match: {
        esTemporal: { $ne: true },
        id_vendedor: { $in: validSellerIds }
      }
    },
    { $unwind: "$sucursales" },
    { $unwind: "$sucursales.combinaciones" },
    {
      $addFields: {
        _variantLabel: variantLabelExpression,
        _descriptionNormalized: {
          $trim: { input: { $ifNull: ["$sucursales.combinaciones.descripcion", ""] } }
        },
        _usageNormalized: {
          $trim: { input: { $ifNull: ["$sucursales.combinaciones.uso", ""] } }
        },
        _promotionTitleNormalized: {
          $trim: { input: { $ifNull: ["$sucursales.combinaciones.promocion.titulo", ""] } }
        },
        _promotionDescriptionNormalized: {
          $trim: {
            input: { $ifNull: ["$sucursales.combinaciones.promocion.descripcion", ""] }
          }
        },
        _promotionStartNormalized: {
          $ifNull: ["$sucursales.combinaciones.promocion.fechaInicio", null]
        },
        _promotionEndNormalized: {
          $ifNull: ["$sucursales.combinaciones.promocion.fechaFin", null]
        },
        _imagesNormalized: { $ifNull: ["$sucursales.combinaciones.imagenes", []] }
      }
    },
    {
      $addFields: {
        _hasDescription: { $gt: [{ $strLenCP: "$_descriptionNormalized" }, 0] },
        _hasUsage: { $gt: [{ $strLenCP: "$_usageNormalized" }, 0] },
        _hasImages: { $gt: [{ $size: "$_imagesNormalized" }, 0] },
        _hasPromotion: {
          $or: [
            { $gt: [{ $strLenCP: "$_promotionTitleNormalized" }, 0] },
            { $gt: [{ $strLenCP: "$_promotionDescriptionNormalized" }, 0] },
            { $ne: ["$_promotionStartNormalized", null] },
            { $ne: ["$_promotionEndNormalized", null] }
          ]
        }
      }
    },
    {
      $addFields: {
        _statusRank: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $eq: ["$_hasDescription", false] },
                    { $eq: ["$_hasUsage", false] },
                    { $eq: ["$_hasImages", false] },
                    { $eq: ["$_hasPromotion", false] }
                  ]
                },
                then: 0
              },
              {
                case: {
                  $and: [
                    { $eq: ["$_hasDescription", true] },
                    { $eq: ["$_hasImages", true] }
                  ]
                },
                then: 2
              }
            ],
            default: 1
          }
        }
      }
    },
    {
      $group: {
        _id: {
          sellerId: "$id_vendedor",
          productId: "$_id",
          variantKey: {
            $ifNull: ["$sucursales.combinaciones.variantKey", "$_variantLabel"]
          }
        },
        statusRank: { $max: "$_statusRank" }
      }
    },
    {
      $group: {
        _id: "$_id.sellerId",
        emptyCount: {
          $sum: {
            $cond: [{ $eq: ["$statusRank", 0] }, 1, 0]
          }
        },
        partialCount: {
          $sum: {
            $cond: [{ $eq: ["$statusRank", 1] }, 1, 0]
          }
        },
        completeCount: {
          $sum: {
            $cond: [{ $eq: ["$statusRank", 2] }, 1, 0]
          }
        }
      }
    },
    {
      $addFields: {
        totalVariants: {
          $add: ["$emptyCount", "$partialCount", "$completeCount"]
        }
      }
    },
    {
      $addFields: {
        productInfoStatus: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gt: ["$totalVariants", 0] },
                    { $eq: ["$completeCount", "$totalVariants"] }
                  ]
                },
                then: "complete"
              },
              {
                case: {
                  $and: [
                    { $eq: ["$completeCount", 0] },
                    { $eq: ["$partialCount", 0] }
                  ]
                },
                then: "empty"
              }
            ],
            default: "partial"
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        sellerId: { $toString: "$_id" },
        totalVariants: 1,
        emptyCount: 1,
        partialCount: 1,
        completeCount: 1,
        productInfoStatus: 1
      }
    }
  ]);

  return result as SellerProductInfoStatusSummary[];
};

const updateVariantExtrasBySeller = async ({
  productId,
  sucursalId,
  variantKey,
  sellerId,
  descripcion,
  uso,
  promocion,
  imagenes
}: {
  productId: string;
  sucursalId?: string;
  variantKey: string;
  sellerId: string;
  descripcion?: string;
  uso?: string;
  promocion?: {
    titulo?: string;
    descripcion?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
  };
  imagenes?: {
    url: string;
    key?: string;
  }[];
}): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findOne({
    _id: productId,
    id_vendedor: sellerId
  });
  if (!producto) {
    throw new Error("Producto no encontrado o no pertenece al vendedor");
  }
  if (sucursalId) {
    const sucursal = producto.sucursales.find(
      s => s.id_sucursal.toString() === sucursalId
    );
    if (!sucursal) {
      throw new Error("Sucursal no encontrada");
    }
    const combinacion = sucursal.combinaciones.find(
      c => c.variantKey === variantKey
    );
    if (!combinacion) {
      throw new Error("Combinaci?n no encontrada");
    }
  }
  let updatedBranches = 0;
  for (const sucursal of producto.sucursales || []) {
    const combinacion = sucursal.combinaciones.find(
      c => c.variantKey === variantKey
    );
    if (!combinacion) continue;
    if (descripcion !== undefined) {
      combinacion.descripcion = descripcion;
    }
    if (uso !== undefined) {
      combinacion.uso = uso;
    }
    if (promocion !== undefined) {
      combinacion.promocion = promocion;
    }
    if (imagenes !== undefined) {
      combinacion.imagenes = imagenes;
    }
    updatedBranches += 1;
  }
  if (!updatedBranches) {
    throw new Error("Combinaci?n no encontrada");
  }
  producto.markModified("sucursales");
  return await producto.save();
};
const findVariantImagesBySeller = async ({
  productId,
  variantKey,
  sellerId
}: {
  productId: string;
  variantKey: string;
  sellerId: string;
}) => {
  const producto = await ProductoModel.findOne({
    _id: productId,
    id_vendedor: sellerId
  })
    .select("sucursales.combinaciones")
    .lean();

  if (!producto) {
    throw new Error("Producto no encontrado o no pertenece al vendedor");
  }

  for (const sucursal of producto.sucursales || []) {
    const combinacion = (sucursal.combinaciones || []).find((item) => item.variantKey === variantKey);
    if (combinacion) {
      return Array.isArray(combinacion.imagenes) ? combinacion.imagenes : [];
    }
  }

  throw new Error("Combinación no encontrada");
};

const updateVariantStockByBranchForSuperadmin = async ({
  productId,
  sellerId,
  variantKey,
  sucursalId,
  stock
}: {
  productId: string;
  sellerId: string;
  variantKey: string;
  sucursalId: string;
  stock: number;
}) => {
  const producto = await ProductoModel.findOne({
    _id: productId,
    id_vendedor: sellerId
  });

  if (!producto) {
    throw new Error("Producto no encontrado para el vendedor seleccionado");
  }

  const sucursal = producto.sucursales.find((item) => String(item.id_sucursal) === sucursalId);
  if (!sucursal) {
    throw new Error("Sucursal no encontrada");
  }

  const combinacion = sucursal.combinaciones.find((item) =>
    variantMatchesKey(String(producto._id), item as any, variantKey)
  );

  if (!combinacion) {
    throw new Error("Variante no encontrada en la sucursal seleccionada");
  }

  combinacion.stock = stock;
  producto.markModified("sucursales");
  await producto.save();

  return {
    productId: String(producto._id),
    variantKey: combinacion.variantKey || createVariantKey(String(producto._id), combinacion.variantes),
    sucursalId,
    stock: combinacion.stock
  };
};

const renameVariantForSuperadmin = async ({
  productId,
  sellerId,
  variantKey,
  sucursalId,
  scope,
  variantAttributes
}: {
  productId: string;
  sellerId: string;
  variantKey: string;
  sucursalId?: string;
  scope: "branch" | "all";
  variantAttributes: Record<string, string>;
}) => {
  const producto = await ProductoModel.findOne({
    _id: productId,
    id_vendedor: sellerId
  });

  if (!producto) {
    throw new Error("Producto no encontrado para el vendedor seleccionado");
  }

  const normalizedVariantAttributes = normalizeVariantRecord(variantAttributes);
  const attributeKeys = Object.keys(normalizedVariantAttributes);
  if (!attributeKeys.length || attributeKeys.some((key) => !normalizedVariantAttributes[key])) {
    throw new Error("Debes completar todos los valores de la variante");
  }

  const targetBranches =
    scope === "branch"
      ? producto.sucursales.filter((item) => String(item.id_sucursal) === String(sucursalId || ""))
      : producto.sucursales;

  if (!targetBranches.length) {
    throw new Error("No se encontró la sucursal objetivo");
  }

  const nextVariantKey = createVariantKey(String(producto._id), normalizedVariantAttributes);
  const targetCombinations: Array<{ branch: any; combination: any }> = [];

  for (const branch of targetBranches) {
    const combination = branch.combinaciones.find((item: any) =>
      variantMatchesKey(String(producto._id), item, variantKey)
    );

    if (!combination) {
      if (scope === "branch") {
        throw new Error("La variante no existe en la sucursal seleccionada");
      }
      continue;
    }

    const hasDuplicate = branch.combinaciones.some((item: any) => {
      if (item === combination) return false;
      return (
        variantMatchesKey(String(producto._id), item, nextVariantKey) ||
        variantRecordsEqual(item.variantes, normalizedVariantAttributes)
      );
    });

    if (hasDuplicate) {
      throw new Error("Ya existe una variante con esos valores en una de las sucursales objetivo");
    }

    targetCombinations.push({ branch, combination });
  }

  if (!targetCombinations.length) {
    throw new Error("No se encontró la variante solicitada");
  }

  for (const { combination } of targetCombinations) {
    combination.variantes = normalizedVariantAttributes;
    combination.variantKey = nextVariantKey;
  }

  producto.markModified("sucursales");
  await producto.save();

  return {
    productId: String(producto._id),
    previousVariantKey: variantKey,
    variantKey: nextVariantKey,
    updatedBranches: targetCombinations.map(({ branch }) => String(branch.id_sucursal))
  };
};

const deleteVariantForSuperadmin = async ({
  productId,
  sellerId,
  variantKey,
  sucursalId,
  scope
}: {
  productId: string;
  sellerId: string;
  variantKey: string;
  sucursalId?: string;
  scope: "branch" | "all";
}) => {
  const producto = await ProductoModel.findOne({
    _id: productId,
    id_vendedor: sellerId
  });

  if (!producto) {
    throw new Error("Producto no encontrado para el vendedor seleccionado");
  }

  const targetBranches =
    scope === "branch"
      ? producto.sucursales.filter((item) => String(item.id_sucursal) === String(sucursalId || ""))
      : producto.sucursales;

  if (!targetBranches.length) {
    throw new Error("No se encontró la sucursal objetivo");
  }

  let removedCount = 0;
  const affectedBranchIds = new Set<string>();

  for (const branch of targetBranches) {
    const beforeCount = branch.combinaciones.length;
    branch.combinaciones = branch.combinaciones.filter(
      (item: any) => !variantMatchesKey(String(producto._id), item, variantKey)
    );
    const removedInBranch = beforeCount - branch.combinaciones.length;

    if (removedInBranch > 0) {
      removedCount += removedInBranch;
      affectedBranchIds.add(String(branch.id_sucursal));
    }
  }

  if (!removedCount) {
    throw new Error("No se encontró la variante solicitada");
  }

  producto.sucursales = producto.sucursales.filter(
    (branch: any) => Array.isArray(branch.combinaciones) && branch.combinaciones.length > 0
  ) as any;

  const hasVariantsLeft = producto.sucursales.some(
    (branch: any) => Array.isArray(branch.combinaciones) && branch.combinaciones.length > 0
  );

  if (!hasVariantsLeft) {
    await ProductoModel.deleteOne({ _id: producto._id });
    return {
      productId: String(producto._id),
      deletedProduct: true,
      affectedBranchIds: Array.from(affectedBranchIds)
    };
  }

  producto.markModified("sucursales");
  await producto.save();

  return {
    productId: String(producto._id),
    deletedProduct: false,
    affectedBranchIds: Array.from(affectedBranchIds)
  };
};

export const ProductRepository = {
  findAll,
  findById,
  findBySellerId,
  registerProduct,
  getProductsBySales,
  updateProduct: async (productId: string, data: Partial<IProducto>) =>
    await ProductoModel.findByIdAndUpdate(productId, data, { new: true }).exec(),
  getStockForSucursal,
  updateStockInSucursal,
  getAllStockByProductId,
  updatePriceInSucursal,
  updateStockOfSubvariant,
  updateStockByVariantCombination,
  addVariantToProduct,
  findAllTemporales,
  findFlatProductList,
  findFlatProductListPage,
  findSellerProductInfoListPage,
  findSuperadminVariantInventoryPage,
  findSellerProductInfoStatusBySellerIds,
  findByQRCode,
  updateVariantExtrasBySeller,
  findVariantImagesBySeller,
  updateVariantStockByBranchForSuperadmin,
  renameVariantForSuperadmin,
  deleteVariantForSuperadmin
  
};


