import { ProductRepository } from "../repositories/product.repository";
import { FeatureRepository } from "../repositories/feature.repository";
import { ICaracteristicas } from "../entities/ICaracteristicas";
import { IProducto } from "../entities/IProducto";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { QRService } from "./qr.service"; 
import puppeteer from "puppeteer";
import ejs from "ejs";
import path from "path";
import fs from "fs/promises";
import { Buffer } from "buffer";
import { Types } from 'mongoose';
import { IProductoDocument } from "../entities/documents/IProductoDocument";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { ProductVariantKeyService } from "./productVariantKey.service";
import { createVariantKey } from "../utils/variantKey";

interface Feature {
  feature: string;
  values: string[];
}

const getAllProducts = async () => {
  return await ProductRepository.findAll();
};
const getAllTemporaryProducts = async () => {
  return await ProductRepository.findAllTemporales();
};


const registerProduct = async (product: IProducto): Promise<any> => {
  console.log("🛠 Entrando a ProductService.registerProduct");
  
  try {
    console.log("📦 Datos de producto recibidos:", JSON.stringify(product, null, 2));

    const nuevoProducto = await ProductRepository.registerProduct(product);
    console.log("✅ Producto guardado en DB con _id:", nuevoProducto._id);

    const variantKeysChanged = ProductVariantKeyService.applyVariantKeysToProduct(nuevoProducto);
    if (variantKeysChanged) {
      await nuevoProducto.save();
    }

    // Generar QR
    try {
      const { qrPath, productCode, productURL } = await QRService.generateAndSaveQR(
        nuevoProducto._id.toString()
      );
      nuevoProducto.qrCode = productCode;
      nuevoProducto.qrImagePath = qrPath;
      nuevoProducto.qrProductURL = productURL;
      await nuevoProducto.save();
      console.log(`✅ QR generado: ${productCode}`);
    } catch (qrError) {
      console.error('⚠️ Error generando QR para producto:', qrError);
    }

    // Asociar a vendedor
    if (nuevoProducto.id_vendedor) {
      console.log("🔍 Buscando vendedor con ID:", nuevoProducto.id_vendedor);
      await VendedorModel.findByIdAndUpdate(
        nuevoProducto.id_vendedor,
        { $push: { producto: nuevoProducto._id } }
      );

      const rawVendedor = await VendedorModel.findById(nuevoProducto.id_vendedor).lean();
      if (!rawVendedor) throw new Error("Vendedor no encontrado");

      console.log("✅ Vendedor encontrado:", rawVendedor);

      const vendedor = rawVendedor as unknown as { pago_sucursales: { id_sucursal: string | Types.ObjectId }[] };
      const sucursalesHabilitadas = vendedor.pago_sucursales || [];

      if (!nuevoProducto.esTemporal && sucursalesHabilitadas.length > 0 && nuevoProducto.sucursales?.length) {
        const combinacionesReferencia = nuevoProducto.sucursales[0]?.combinaciones || [];
        for (const sucursal of sucursalesHabilitadas) {
          const id_sucursal = new Types.ObjectId(sucursal.id_sucursal.toString());
          const yaExiste = nuevoProducto.sucursales.some(
            s => s.id_sucursal.toString() === id_sucursal.toString()
          );
          if (yaExiste) continue;
          nuevoProducto.sucursales.push({
            id_sucursal,
            combinaciones: combinacionesReferencia.map(c => ({
              variantes: c.variantes,
              variantKey: c.variantKey || createVariantKey(nuevoProducto._id.toString(), c.variantes),
              precio: c.precio,
              stock: 0
            }))
          });
        }
        await nuevoProducto.save();
      }
    }

    return nuevoProducto;
  } catch (err: any) {
    console.error("❌ Error exacto en ProductService.registerProduct:", err?.message || err);
    throw err;
  }
};

const regenerateProductQR = async (productId: string): Promise<{
  qrCode: string;
  qrImagePath: string;
  qrProductURL: string;
  qrBase64?: string;
}> => {
  const producto = await ProductRepository.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  // Generar nuevo QR
  const { qrPath, productCode, productURL } = await QRService.generateAndSaveQR(productId);
  const { qrBase64 } = await QRService.generateQRBase64(productId, productCode);

  // Actualizar producto
  await ProductRepository.updateProduct(productId, {
    qrCode: productCode,
    qrImagePath: qrPath,
    qrProductURL: productURL
  });

  return {
    qrCode: productCode,
    qrImagePath: qrPath,
    qrProductURL: productURL,
    qrBase64
  };
};

const getProductQR = async (productId: string, format: 'path' | 'base64' = 'path') => {
  const producto = await ProductRepository.findById(productId);
  if (!producto) throw new Error("Producto no encontrado");

  if (!producto.qrCode) {
    // Si no tiene QR, generarlo
    return await regenerateProductQR(productId);
  }

  if (format === 'base64') {
    const { qrBase64 } = await QRService.generateQRBase64(productId, producto.qrCode);
    return {
      qrCode: producto.qrCode,
      qrImagePath: producto.qrImagePath,
      qrProductURL: producto.qrProductURL,
      qrBase64
    };
  }

  return {
    qrCode: producto.qrCode,
    qrImagePath: producto.qrImagePath,
    qrProductURL: producto.qrProductURL
  };
};

const findProductByQRCode = async (qrCode: string) => {
  return await ProductRepository.findByQRCode(qrCode);
};

const getFeaturesById = async (productId: string) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw new Error("Producto no encontrado");

  const features = await FeatureRepository.getFeaturesByProductId(product);

  return features.reduce((acc, cur) => {
    const existing = acc.find(f => f.feature === cur.feature);
    if (existing) {
      existing.values.push(cur.value);
    } else {
      acc.push({ feature: cur.feature, values: [cur.value] });
    }
    return acc;
  }, [] as Feature[]);
};

const addFeatureToProduct = async (productId: string, featureData: any) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw new Error("Producto no encontrado");

  const feature: ICaracteristicas = {
    ...featureData,
    product: product._id
  };

  return await FeatureRepository.registerFeature(feature);
};

const getProductById = async (productId: string) => {
  const product = await ProductRepository.findById(productId);
  if (!product) throw new Error("Producto no encontrado");
  return product;
};

const getAllProductsEntryAmountBySellerId = async (sellerId: string) => {
  const products = await ProductRepository.findBySellerId(sellerId);
  if (!products) throw new Error("No hay productos para ese vendedor");
  return products;
};

const getProductStock = async (productId: string, sucursalId: string) => {
  return await ProductRepository.getStockForSucursal(productId, sucursalId);
};

const getAllStockByProductId = async (productId: string) => {
  return await ProductRepository.getAllStockByProductId(productId);
};

const updateStockInSucursal = async (
  productId: string,
  sucursalId: string,
  variante: string,
  stock: number
) => {
  return await ProductRepository.updateStockInSucursal(productId, sucursalId, variante, stock);
};

const updatePrice = async (
  updates: {
    productId: string;
    sucursalId: string;
    variantes: Record<string, string>;
    precio: number;
  }[]
) => {
  const result = [];
  for (const u of updates) {
    const updated = await ProductRepository.updatePriceInSucursal(
      u.productId,
      u.sucursalId,
      u.variantes,
      u.precio
    );
    result.push(updated);
  }
  return result;
};


const updateSubvariantStock = async (params: {
  productId: string;
  sucursalId: string;
  varianteNombre: string;
  subvarianteNombre: string;
  stock: number;
}) => {
  return await ProductRepository.updateStockOfSubvariant(
    params.productId,
    params.sucursalId,
    params.varianteNombre,
    params.subvarianteNombre,
    params.stock
  );
};

const updateStockByVariantCombination = async ({
  productId,
  sucursalId,
  variantes,
  stock
}: {
  productId: string,
  sucursalId: string,
  variantes: Record<string, string>,
  stock: number
}) => {
  return await ProductRepository.updateStockByVariantCombination(productId, sucursalId, variantes, stock);
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

  const vendedor = await VendedorModel.findById(producto.id_vendedor).lean();
  if (!vendedor) throw new Error("Vendedor no encontrado");

  // 🔧 casting correcto
  const sucursalesHabilitadas = (vendedor.pago_sucursales as { id_sucursal: string | Types.ObjectId }[]) || [];

  const normalizedCombinaciones = combinaciones.map((c) => ({
    ...c,
    variantKey: (c as any).variantKey || createVariantKey(productId, c.variantes)
  }));

  for (const sucursalPago of sucursalesHabilitadas) {
    const id_sucursal = sucursalPago.id_sucursal.toString();

    let sucursalProducto = producto.sucursales.find(
      s => (s as any).id_sucursal.toString() === id_sucursal
    );

    if (!sucursalProducto) {
      // Crear sucursal nueva
        producto.sucursales.push({
          id_sucursal: new Types.ObjectId(id_sucursal),
          combinaciones: normalizedCombinaciones.map(c => ({
            variantes: c.variantes,
            variantKey: c.variantKey,
            precio: c.precio,
            stock: 0
          }))
        });
      } else {
        // Agregar combinaciones faltantes
      for (const nueva of normalizedCombinaciones) {
        const yaExiste = sucursalProducto.combinaciones.some(c =>
          Object.keys(c.variantes).length === Object.keys(nueva.variantes).length &&
          Object.keys(nueva.variantes).every(
            key => c.variantes[key]?.toLowerCase?.() === nueva.variantes[key]?.toLowerCase?.()
          )
        );

        if (!yaExiste) {
          sucursalProducto.combinaciones.push({
            variantes: nueva.variantes,
            variantKey: nueva.variantKey,
            precio: nueva.precio,
            stock: sucursalId.toString() === id_sucursal ? nueva.stock : 0
          });
        }
      }
    }
  }

  return await producto.save();
};


const updateProduct = async (productId: string, data: Partial<IProducto>) => {
  return await ProductRepository.updateProduct(productId, data);

}
const generateIngressPDF = async (data: any): Promise<Buffer> => {
  const templatePath = path.resolve(__dirname, "../templates/ingress-pdf.ejs");
  const logoPath = path.resolve(__dirname, "../../public/logo.png");

  const logoBuffer = await fs.readFile(logoPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  // Transformar los ingresos (stockData)
  const stockData = (data.ingresos || []).map((item: any) => {
    const producto = item.product || {};
    return {
      nombre_producto: producto.nombre_producto || "-",
      variantes: Object.entries(producto.variantes || {}).map(([_, v]) => v).join(" / "),
      stock: producto.stock || "",
      precio: producto.precio || "",
      ingresos: item.newStock?.stock || "",
      categoria: producto.categoria || "Ropa"
    };
  });

  // Transformar las variantes nuevas
  const variantData = (data.variantes || []).flatMap((v: any) =>
    v.combinaciones.map((c: any) => ({
      nombre_producto: v.product?.nombre_producto || "-",
      variantes: Object.entries(c.variantes || {}).map(([k, v]) => `${k}: ${v}`).join(" / "),
      stock: c.stock,
      precio: c.precio
    }))
  );

  // Transformar los productos nuevos
  const productData = (data.productos || []).map((p: any) => ({
    nombre_producto: p.nombre_producto || "-",
    variantes: p.variantes || "-",
    stock: p.stock || "",
    precio: p.precio || ""
  }));

  const html: string = await ejs.renderFile(templatePath, {
    sellerName: data.sellerName || "Vendedor no definido",
    sucursal: data.sucursalNombre || "Sucursal desconocida",
    logoBase64,
    date: new Date().toLocaleString(),
    stockData,
    variantData,
    productData
  }) as string;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  return Buffer.from(pdfBuffer);
};
const getFlatProductList = async (params?: {
  sucursalId?: string;
  sellerId?: string;
  sellerIds?: string[];
  categoryId?: string;
  inStock?: boolean;
  q?: string;
}) => {
  return await ProductRepository.findFlatProductList(params);
};

const getFlatProductListPage = async (params?: {
  sucursalId?: string;
  sellerId?: string;
  categoryId?: string;
  inStock?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}) => {
  return await ProductRepository.findFlatProductListPage(params);
};

const getSellerProductInfoListPage = async (params: {
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
}) => {
  return await ProductRepository.findSellerProductInfoListPage(params);
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
}) => {
  if (descripcion && descripcion.length > 500) {
    throw new Error("La descripcion no puede exceder 500 caracteres");
  }

  if (uso && uso.length > 500) {
    throw new Error("El uso no puede exceder 500 caracteres");
  }

  if (imagenes && imagenes.length > 4) {
    throw new Error("Solo se permiten máximo 4 imágenes");
  }

  if (promocion?.titulo && promocion.titulo.length > 60) {
    throw new Error("El título de la promoción no puede exceder 60 caracteres");
  }

  if (promocion?.descripcion && promocion.descripcion.length > 150) {
    throw new Error("La descripción de la promoción no puede exceder 150 caracteres");
  }

  if (promocion?.fechaInicio && promocion?.fechaFin) {
    const inicio = new Date(promocion.fechaInicio);
    const fin = new Date(promocion.fechaFin);

    if (fin < inicio) {
      throw new Error("La fechaFin no puede ser menor a la fechaInicio");
    }
  }

  return await ProductRepository.updateVariantExtrasBySeller({
    productId,
    sucursalId,
    variantKey,
    sellerId,
    descripcion,
    uso,
    promocion,
    imagenes
  });
};

const getSellerVariantImages = async ({
  productId,
  variantKey,
  sellerId
}: {
  productId: string;
  variantKey: string;
  sellerId: string;
}) => {
  return await ProductRepository.findVariantImagesBySeller({
    productId,
    variantKey,
    sellerId
  });
};

export const ProductService = {
  getAllProducts,
  registerProduct,
  getFeaturesById,
  getAllProductsEntryAmountBySellerId,
  addFeatureToProduct,
  getProductById,
  getProductStock,
  getAllStockByProductId,
  updateStockInSucursal,
  updatePrice,
  updateSubvariantStock,
  updateStockByVariantCombination,
  addVariantToProduct,
  updateProduct,
  generateIngressPDF,
  getAllTemporaryProducts,
  getFlatProductList,
  getFlatProductListPage,
  getSellerProductInfoListPage,
  regenerateProductQR,
  getProductQR,
  findProductByQRCode,
  updateVariantExtrasBySeller,
  getSellerVariantImages
};

