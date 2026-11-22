import { promises as fs } from "fs";
import path from "path";
import mongoose from "mongoose";
import connectToMongoDB from "../config/mongoConnection";
import { CategoriaModel } from "../entities/implements/CategoriaSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";

type ObjectIdLike = { toString(): string };

type Combination = {
  variantes?: Record<string, string> | Map<string, string>;
  precio?: number;
  stock?: number;
};

type ProductBranch = {
  id_sucursal?: ObjectIdLike;
  combinaciones?: Combination[];
};

type AuditProduct = {
  _id: ObjectIdLike;
  nombre_producto: string;
  fecha_de_ingreso?: Date;
  categoria?: ObjectIdLike;
  sucursales?: ProductBranch[];
};

type AuditCategory = {
  _id: ObjectIdLike;
  categoria: string;
};

const columns = [
  "producto_id_anonimo",
  "nombre_producto",
  "categoria",
  "fecha_ingreso",
  "sucursal_anonima",
  "variantes",
  "precio",
  "stock",
];

const escapeCsv = (value: string | number): string => {
  const normalized = String(value).replace(/\r?\n/g, " ");
  return `"${normalized.replace(/"/g, '""')}"`;
};

const formatVariants = (variantes: Combination["variantes"]): string => {
  if (!variantes) return "";

  const entries = variantes instanceof Map
    ? Array.from(variantes.entries())
    : Object.entries(variantes);

  return entries.map(([key, value]) => `${key}: ${value}`).join(" | ");
};

const formatDate = (value?: Date): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const run = async (): Promise<void> => {
  let productCount = 0;
  let rowCount = 0;
  let missingCategoryCount = 0;

  try {
    await connectToMongoDB();

    const products = await ProductoModel.find(
      {},
      {
        nombre_producto: 1,
        fecha_de_ingreso: 1,
        categoria: 1,
        sucursales: 1,
      }
    )
      .sort({ _id: 1 })
      .lean<AuditProduct[]>();

    const categoryIds = [
      ...new Set(
        products
          .map((product) => product.categoria?.toString())
          .filter((categoryId): categoryId is string => Boolean(categoryId))
      ),
    ];

    const categories = await CategoriaModel.find(
      { _id: { $in: categoryIds } },
      { categoria: 1 }
    ).lean<AuditCategory[]>();
    const categoryNames = new Map(
      categories.map((category) => [category._id.toString(), category.categoria])
    );

    const productCodes = new Map<string, string>();
    const branchCodes = new Map<string, string>();
    const lines = [columns.map(escapeCsv).join(",")];

    for (const product of products) {
      productCount += 1;
      const productId = product._id.toString();
      const productCode = `PROD-${String(productCodes.size + 1).padStart(6, "0")}`;
      productCodes.set(productId, productCode);

      const categoryId = product.categoria?.toString();
      const categoryName = categoryId ? categoryNames.get(categoryId) ?? "" : "";
      if (categoryId && !categoryNames.has(categoryId)) missingCategoryCount += 1;

      for (const branch of product.sucursales ?? []) {
        if (!branch.id_sucursal) continue;

        const branchId = branch.id_sucursal.toString();
        let branchCode = branchCodes.get(branchId);
        if (!branchCode) {
          branchCode = `SUC-${String(branchCodes.size + 1).padStart(3, "0")}`;
          branchCodes.set(branchId, branchCode);
        }

        for (const combination of branch.combinaciones ?? []) {
          const row = [
            productCode,
            product.nombre_producto,
            categoryName,
            formatDate(product.fecha_de_ingreso),
            branchCode,
            formatVariants(combination.variantes),
            combination.precio ?? "",
            combination.stock ?? "",
          ];
          lines.push(row.map(escapeCsv).join(","));
          rowCount += 1;
        }
      }
    }

    const outputDirectory = path.resolve(process.cwd(), "exports");
    await fs.mkdir(outputDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(outputDirectory, `productos-auditoria-${timestamp}.csv`);
    await fs.writeFile(outputPath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");

    console.log(`[audit-products-export] file=${outputPath}`);
    console.log(
      `[audit-products-export] products=${productCount} rows=${rowCount} missing_categories=${missingCategoryCount}`
    );
  } catch (error) {
    console.error("[audit-products-export] failed", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

void run();
