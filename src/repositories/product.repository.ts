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
  findByQRCode,
  updateVariantExtrasBySeller
  
};
