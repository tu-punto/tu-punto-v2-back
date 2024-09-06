import * as EntryRepository from '../repositories/entry.repository'
import { ProductRepository } from "../repositories/product.repository";

export const getProductsEntryAmount = async (sellerId: number) => {
    const products = await EntryRepository.findBySellerId(sellerId)
    if (!products) throw new Error("Doesn't exist such products with that seller id as fk")
    return products
}

export const deleteEntriesByIds = async (entriesIds: number[]) => {
    if (!entriesIds || entriesIds.length === 0) {
        throw new Error("No entries IDs provided for deletion.");
    }
    const entries = await EntryRepository.getEntriesByIds(entriesIds);
    if (!entries || entries.length === 0) {
        throw new Error("No entries found for the provided IDs.");
    }
    const deletedEntries = await EntryRepository.deleteEntriesByIds(entriesIds);
    if (deletedEntries) {
        for (const entry of entries) {
            const { id_producto, cantidad_ingreso, id_sucursal } = entry;
            const productStock = await ProductRepository.getStockProduct(id_producto, id_sucursal);
            if (productStock) {
                const updatedStock = {
                    cantidad_por_sucursal: (productStock.cantidad_por_sucursal || 0) - cantidad_ingreso
                };
                await ProductRepository.updateStock(productStock, updatedStock);
            }
        }
    } else {
        throw new Error("It was not possible to reduce stock from deleted entries products")
    }
}

export const updateEntryById = async (newData: any, entryId: number) => {
    const entry = await EntryRepository.findById(entryId)
    if (!entry) throw new Error(`Entry with id ${entryId} doesn't exist`);
    const oldAmount = entry.cantidad_ingreso;

    const updatedEntry = await EntryRepository.updateEntryById(newData, entry)
    const newAmount = updatedEntry.cantidad_ingreso;

    if (updatedEntry) {
        const { id_producto, cantidad_ingreso, id_sucursal } = entry;
        const productStock = await ProductRepository.getStockProduct(id_producto, id_sucursal);
        if (productStock) {
            const difference = newAmount - oldAmount;
            const updatedStock = {
                cantidad_por_sucursal: (productStock.cantidad_por_sucursal || 0) + difference
            };
            await ProductRepository.updateStock(productStock, updatedStock);
        }
    } else {
        throw new Error("It was not possible to update stock product")
    }

    return updatedEntry
}
