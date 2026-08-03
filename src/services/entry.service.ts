import * as EntryRepository from "../repositories/entry.repository";
import { ProductRepository } from "../repositories/product.repository";
import { Types } from "mongoose";
import { InventoryAuditActor, InventoryAuditService } from "./inventoryAudit.service";

const normalizeVariants = (value: any): Record<string, string> => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === "function") return value.toObject();
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [String(key).trim(), String(item ?? "").trim()])
  );
};

export const getProductsEntryAmount = async (sellerId: any) => {
  const products = await EntryRepository.findBySellerId(sellerId);
  if (!products) throw new Error("Doesn't exist such products with that seller id as fk");
  return products;
};

export const getProductEntryDetails = async (productId: any) => {
  const productHistory = await EntryRepository.findByProductId(productId);
  if (!productHistory) throw new Error("Doesn't exist such product history with that product id");
  return productHistory;
};

export const deleteEntriesByIds = async (entriesIds: any[], auditActor?: InventoryAuditActor) => {
  if (!entriesIds || entriesIds.length === 0) {
    throw new Error("No entries IDs provided for deletion.");
  }

  const entries = await EntryRepository.getEntriesByIds(entriesIds);
  if (!entries || entries.length === 0) {
    throw new Error("No entries found for the provided IDs.");
  }

  const deletedEntries = await EntryRepository.deleteEntriesByIds(entriesIds);
  const auditMovements: any[] = [];

  if (deletedEntries) {
    for (const entry of entries) {
      const { producto, cantidad_ingreso, sucursal, combinacion } = entry;

      const productoDoc = await ProductRepository.findById(producto.toString());
      if (!productoDoc) throw new Error("Producto no encontrado");

      const sucursalDoc = productoDoc.sucursales.find((s) => s.id_sucursal.equals(sucursal));
      if (!sucursalDoc) throw new Error("Sucursal no encontrada");

      const combinacionObj = sucursalDoc.combinaciones.find(
        (c) => JSON.stringify(c.variantes) === JSON.stringify(combinacion)
      );
      if (!combinacionObj) throw new Error("Combinación no encontrada");

      const stockBefore = Number(combinacionObj.stock || 0);
      const stockAfter = Math.max(0, stockBefore - Number(cantidad_ingreso || 0));
      combinacionObj.stock = stockAfter;
      await productoDoc.save();

      auditMovements.push({
        productId: String(productoDoc._id),
        productNameSnapshot: String((productoDoc as any).nombre_producto || "Producto"),
        variantAttributesSnapshot: normalizeVariants(combinacion),
        stockBefore,
        stockAfter,
        sellerId: String((productoDoc as any).id_vendedor || entry.vendedor || ""),
        branchId: String(sucursal || ""),
      });
    }

    await InventoryAuditService.recordEventSafe({
      eventType: "entry_deleted_stock_adjustment",
      sourceModule: "entry.delete",
      sourceId: entriesIds.map((id) => String(id)).join(","),
      actor: auditActor,
      metadata: {
        entryCount: auditMovements.length,
      },
      movements: auditMovements,
    });
  } else {
    throw new Error("No fue posible reducir el stock de los productos eliminados");
  }
};

export const deleteProductEntries = async (entryData: any[]) => {
  return await EntryRepository.deleteProductEntries(entryData);
};

export const updateEntries = async (entries: any[], auditActor?: InventoryAuditActor) => {
  const updatedEntries = [];
  const auditMovements: any[] = [];

  for (const entry of entries) {
    const entryId = new Types.ObjectId(entry.id_ingreso);

    const existingEntry = await EntryRepository.findById(entryId);
    if (!existingEntry) throw new Error(`Entrada con id ${entry.id_ingreso} no existe`);

    const oldAmount = existingEntry.cantidad_ingreso;

    const updatedEntry = await EntryRepository.updateEntryById(entry, entryId);
    if (updatedEntry) {
      const newAmount = updatedEntry.cantidad_ingreso;
      const { producto, sucursal, combinacion } = existingEntry;

      const productoDoc = await ProductRepository.findById(producto.toString());
      if (!productoDoc) throw new Error("Producto no encontrado");

      const sucursalDoc = productoDoc.sucursales.find((s) => s.id_sucursal.equals(sucursal));
      if (!sucursalDoc) throw new Error("Sucursal no encontrada");

      const combinacionObj = sucursalDoc.combinaciones.find(
        (c) => JSON.stringify(c.variantes) === JSON.stringify(combinacion)
      );
      if (!combinacionObj) throw new Error("Combinación no encontrada");

      const diferencia = newAmount - oldAmount;
      const stockBefore = Number(combinacionObj.stock || 0);
      const stockAfter = stockBefore + Number(diferencia || 0);
      combinacionObj.stock = stockAfter;
      await productoDoc.save();

      auditMovements.push({
        productId: String(productoDoc._id),
        productNameSnapshot: String((productoDoc as any).nombre_producto || "Producto"),
        variantAttributesSnapshot: normalizeVariants(combinacion),
        stockBefore,
        stockAfter,
        sellerId: String((productoDoc as any).id_vendedor || existingEntry.vendedor || ""),
        branchId: String(sucursal || ""),
      });

      updatedEntries.push(updatedEntry);
    } else {
      throw new Error(`No se pudo actualizar la entrada con id ${entry.id_ingreso}`);
    }
  }

  await InventoryAuditService.recordEventSafe({
    eventType: "entry_updated_stock_adjustment",
    sourceModule: "entry.update",
    sourceId: entries.map((entry) => String(entry?.id_ingreso || "")).filter(Boolean).join(","),
    actor: auditActor,
    metadata: {
      entryCount: auditMovements.length,
    },
    movements: auditMovements,
  });

  return updatedEntries;
};

export const updateProductEntries = async (entryData: any[]) => {
  return await EntryRepository.updateProductEntries(entryData);
};

export const createEntry = async (entryData: any) => {
  return await EntryRepository.createEntry(entryData);
};
