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
  sucursalId: string,
  variante: Record<string, string>,
  nuevoPrecio: number
): Promise<IProductoDocument | null> => {
  const producto = await ProductoModel.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  const sucursal = producto.sucursales.find(s => s.id_sucursal.equals(sucursalId));
  if (!sucursal) throw new Error("Sucursal no encontrada");

  console.log("🔍 Buscando combinación con variantes:", variante);
  console.log("📦 Combinaciones disponibles:");
  sucursal.combinaciones.forEach((c, i) => {
    console.log(`🧪 Combinación #${i + 1}:`, c.variantes);
  });

  let combinacion = sucursal.combinaciones.find(c => {
    const variantesPlanas = Object.fromEntries(
      c.variantes instanceof Map ? c.variantes : Object.entries(c.variantes || {})
    );
    const combKeys = Object.keys(variantesPlanas);
    const inputKeys = Object.keys(variante);

    if (combKeys.length !== inputKeys.length) return false;

    return inputKeys.every(key =>
      (variantesPlanas[key] || "").toLowerCase() === (variante[key] || "").toLowerCase()
    );
  });

  if (!combinacion) {
    // Si no existe, la creamos con precio y stock inicial 0
    combinacion = {
      variantes: variante,
      variantKey: createVariantKey(productId, variante),
      precio: nuevoPrecio,
      stock: 0
    };
    sucursal.combinaciones.push(combinacion);
    console.log("🆕 Combinación nueva creada:", combinacion);
  } else {
    // Si existe, simplemente actualizamos el precio
    combinacion.precio = nuevoPrecio;
    console.log("✅ Precio actualizado en combinación existente.");
  }

  return await producto.save();
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
        imagenes: 1,
        imagenesCount: { $size: "$imagenes" },
        hasImages: 1,
        hasDescription: 1,
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

const updateVariantExtrasBySeller = async ({
  productId,
  sucursalId,
  variantKey,
  sellerId,
  descripcion,
  promocion,
  imagenes
}: {
  productId: string;
  sucursalId: string;
  variantKey: string;
  sellerId: string;
  descripcion?: string;
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
    throw new Error("Combinación no encontrada");
  }

  if (descripcion !== undefined) {
    combinacion.descripcion = descripcion;
  }

  if (promocion !== undefined) {
    combinacion.promocion = promocion;
  }

  if (imagenes !== undefined) {
    combinacion.imagenes = imagenes;
  }
  producto.markModified("sucursales");

  return await producto.save();
};

const updateSellerProductInfoByVariant = async ({
  productId,
  variantKey,
  sellerId,
  descripcion,
  promocion,
  imagenes
}: {
  productId: string;
  variantKey: string;
  sellerId: string;
  descripcion?: string;
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
}) => {
  const producto = await ProductoModel.findOne({
    _id: productId,
    id_vendedor: sellerId
  });

  if (!producto) {
    throw new Error("Producto no encontrado o no pertenece al vendedor");
  }

  let updatedBranches = 0;

  for (const sucursal of producto.sucursales || []) {
    const combinacion = sucursal.combinaciones.find((item) => item.variantKey === variantKey);
    if (!combinacion) continue;

    if (descripcion !== undefined) {
      combinacion.descripcion = descripcion;
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
    throw new Error("Combinación no encontrada");
  }

  producto.markModified("sucursales");
  await producto.save();

  return {
    productId,
    variantKey,
    updatedBranches
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
  findByQRCode,
  updateVariantExtrasBySeller,
  updateSellerProductInfoByVariant
  
};
