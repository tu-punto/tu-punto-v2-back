import * as EntryRepository from '../repositories/entry.repository'
import { ProductRepository } from "../repositories/product.repository";
import { Types } from 'mongoose';

export const getProductsEntryAmount = async (sellerId: any) => {
    const products = await EntryRepository.findBySellerId(sellerId)
    if (!products) throw new Error("Doesn't exist such products with that seller id as fk")
    return products
}

export const getProductEntryDetails = async (productId: any) => {
    const productHistory = await EntryRepository.findByProductId(productId)
    if (!productHistory) throw new Error("Doesn't exist such product history with that product id")
    return productHistory
}

export const deleteEntriesByIds = async (entriesIds: any[]) => {
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

export const deleteProductEntries = async (entryData: any[]) => {
    return await EntryRepository.deleteProductEntries(entryData);
};

export const updateEntries = async (entries: any[]) => {
    const updatedEntries = [];

    for (const entry of entries) {
        // Asegúrate de que entry.id_ingreso sea un ObjectId
        const entryId = new Types.ObjectId(entry.id_ingreso);

        const existingEntry = await EntryRepository.findById(entryId);
        if (!existingEntry) throw new Error(`Entry with id ${entry.id_ingreso} doesn't exist`);

        const oldAmount = existingEntry.cantidad_ingreso;

        // Cambié el parámetro para pasar el ObjectId correctamente
        const updatedEntry = await EntryRepository.updateEntryById(entry, entryId);

        if (updatedEntry) {
            const newAmount = updatedEntry.cantidad_ingreso; // Ya aseguramos que updatedEntry no es null

            const { id_producto, cantidad_ingreso, id_sucursal } = existingEntry;

            const productStock = await ProductRepository.getStockProduct(id_producto, id_sucursal);
            if (productStock) {
                const difference = newAmount - oldAmount;
                const updatedStock = {
                    cantidad_por_sucursal: (productStock.cantidad_por_sucursal || 0) + difference
                };
                await ProductRepository.updateStock(productStock, updatedStock);
            } else {
                throw new Error("It was not possible to update stock product");
            }

            updatedEntries.push(updatedEntry);
        } else {
            throw new Error(`Failed to update entry with id ${entry.id_ingreso}`);
        }
    }

    return updatedEntries;
};

export const updateProductEntries = async (entryData: any[]) => {
    return await EntryRepository.updateProductEntries(entryData);
};

export const createEntry = async (entryData: any) => {
    return await EntryRepository.createEntry(entryData);
};

