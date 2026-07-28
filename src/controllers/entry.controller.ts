import { Request, Response } from "express";
import * as EntryService from '../services/entry.service'
import { ProductoModel } from "../entities/implements/ProductoSchema";

export const getProductsEntryAmount = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const stock = await EntryService.getProductsEntryAmount(id)
    res.json(stock)
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Error getting entry amount by a seller Id', error });

  }
}

export const getProductEntryDetails = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const stock = await EntryService.getProductEntryDetails(id)
    res.json(stock)
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Error getting entry amount by a product Id', error });

  }
}

export const deleteEntries = async (req: Request, res: Response) => {
  const entries = req.body.entries;
  try {
    const entryIds = entries.map((entry: { id_ingreso: number }) => entry.id_ingreso);
    const auth = res.locals.auth as { id?: string; role?: string; email?: string; sellerId?: string } | undefined;
    const deletedEntries = await EntryService.deleteEntriesByIds(entryIds, {
      userId: String(auth?.id || "").trim() || undefined,
      role: String(auth?.role || "").trim() || undefined,
      name: String(auth?.email || "").trim() || undefined,
      sellerId: String(auth?.sellerId || "").trim() || undefined,
    });
    res.json({
      status: true,
      message: 'Entries deleted successfully',
      data: deletedEntries
    })

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error deleting entries', error })
  }
};

export const deleteEntriesOfProducts = async (req: Request, res: Response) => {
  const entryData = req.body;
  try {
    const deletedEntries = await EntryService.deleteProductEntries(entryData);
    res.json({
      status: true,
      deletedEntries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error deleting entries", error });
  }
};

export const updateEntry = async (req: Request, res: Response) => {
  const entries = req.body.entries
  try {
    const auth = res.locals.auth as { id?: string; role?: string; email?: string; sellerId?: string } | undefined;
    const entryUpdated = await EntryService.updateEntries(entries, {
      userId: String(auth?.id || "").trim() || undefined,
      role: String(auth?.role || "").trim() || undefined,
      name: String(auth?.email || "").trim() || undefined,
      sellerId: String(auth?.sellerId || "").trim() || undefined,
    });
    res.status(200).json({
      status: "success",
      message: `${entryUpdated.length} entries updated successfully`,
      data: entryUpdated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error updating entries", error });
  }
};

export const updateEntriesOfProducts = async (req: Request, res: Response) => {
  const entryData = req.body;
  try {
    const updatedEntries = await EntryService.updateProductEntries(entryData);
    res.json({
      status: true,
      updatedEntries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error updating entries", error });
  }
};

export const createEntry = async (req: Request, res: Response) => {
  const entryData = req.body;

  try {
    const producto = await ProductoModel.findById(entryData.producto);
    if (!producto) {
      return res.status(404).json({ success: false, message: "Producto no encontrado" });
    }
    entryData.vendedor = producto.id_vendedor;
    if (!entryData.fecha_ingreso) {
      entryData.fecha_ingreso = new Date();
    }

    const entry = await EntryService.createEntry(entryData);

    if (!producto.ingreso) {
      producto.ingreso = [];
    }
    producto.ingreso.push(entry._id);
    await producto.save();

    res.json({
      status: true,
      entry,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error creating entry", error });
  }
};

