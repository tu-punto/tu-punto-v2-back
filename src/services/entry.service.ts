import * as EntryRepository from '../repositories/entry.repository';
import { ProductRepository } from "../repositories/product.repository";
import { Types } from 'mongoose';

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
            const { producto, cantidad_ingreso, sucursal, nombre_variante } = entry;

            const productoDoc = await ProductRepository.findById(producto.toString());
            if (!productoDoc) throw new Error("Producto no encontrado");

            const sucursalDoc = productoDoc.sucursales.find(s => s.id_sucursal.equals(sucursal));
            if (!sucursalDoc) throw new Error("Sucursal no encontrada");

            const variante = sucursalDoc.variantes.find(v => v.nombre_variante === nombre_variante);
            if (!variante) throw new Error("Variante no encontrada");

            const nuevoStock = variante.stock - cantidad_ingreso;
            await ProductRepository.updateStockInSucursal(
                producto.toString(),
                sucursal.toString(),
                nombre_variante,
                nuevoStock
            );
        }
    } else {
        throw new Error("It was not possible to reduce stock from deleted entries products");
    }
};

export const deleteProductEntries = async (entryData: any[]) => {
    return await EntryRepository.deleteProductEntries(entryData);
};

export const updateEntries = async (entries: any[]) => {
    const updatedEntries = [];

    for (const entry of entries) {
        const entryId = new Types.ObjectId(entry.id_ingreso);

        const existingEntry = await EntryRepository.findById(entryId);
        if (!existingEntry) throw new Error(`Entry with id ${entry.id_ingreso} doesn't exist`);

        const oldAmount = existingEntry.cantidad_ingreso;

        const updatedEntry = await EntryRepository.updateEntryById(entry, entryId);
        if (updatedEntry) {
            const newAmount = updatedEntry.cantidad_ingreso;
            const { producto, sucursal, nombre_variante } = existingEntry;

            const productoDoc = await ProductRepository.findById(producto.toString());
            if (!productoDoc) throw new Error("Producto no encontrado");

            const sucursalDoc = productoDoc.sucursales.find(s => s.id_sucursal.equals(sucursal));
            if (!sucursalDoc) throw new Error("Sucursal no encontrada");

            const variante = sucursalDoc.variantes.find(v => v.nombre_variante === nombre_variante);
            if (!variante) throw new Error("Variante no encontrada");

            const diferencia = newAmount - oldAmount;
            const nuevoStock = variante.stock + diferencia;

            await ProductRepository.updateStockInSucursal(
                producto.toString(),
                sucursal.toString(),
                nombre_variante,
                nuevoStock
            );

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
