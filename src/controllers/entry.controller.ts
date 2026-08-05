import { Request, Response } from "express";
import * as EntryService from '../services/entry.service'
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { ActionTraceService } from "../services/actionTrace.service";
import { getActionTraceActorFromResponse } from "../helpers/actionTrace";

const traceAction = (
  res: Response,
  payload: {
    actionType: string;
    sourceModule: string;
    sourceId?: string;
    entityType?: string;
    entityId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
  status: "success" | "failed" = "success",
  error?: unknown
) => {
  if (status === "failed") {
    void ActionTraceService.recordFailureFromError({
      ...payload,
      actor: getActionTraceActorFromResponse(res),
      error,
    });
    return;
  }

  void ActionTraceService.recordActionTraceSafe({
    ...payload,
    actor: getActionTraceActorFromResponse(res),
    status: "success",
  });
};

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
    traceAction(res, {
      actionType: "entry.delete",
      sourceModule: "entry.controller",
      sourceId: entryIds.join(","),
      entityType: "entry",
      summary: `Se eliminaron ${entryIds.length} entradas`,
      metadata: { count: entryIds.length },
    });
    res.json({
      status: true,
      message: 'Entries deleted successfully',
      data: deletedEntries
    })

  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "entry.delete",
      sourceModule: "entry.controller",
      sourceId: Array.isArray(entries) ? entries.map((entry: any) => String(entry?.id_ingreso || "")).filter(Boolean).join(",") : "",
      entityType: "entry",
      summary: "Falló la eliminación de entradas",
      metadata: { count: Array.isArray(entries) ? entries.length : 0 },
    }, "failed", error);
    res.status(500).json({ msg: 'Error deleting entries', error })
  }
};

export const deleteEntriesOfProducts = async (req: Request, res: Response) => {
  const entryData = req.body;
  try {
    const deletedEntries = await EntryService.deleteProductEntries(entryData);
    traceAction(res, {
      actionType: "entry.delete_products",
      sourceModule: "entry.controller",
      entityType: "entry",
      summary: `Se eliminaron ${Array.isArray(deletedEntries) ? deletedEntries.length : 0} entradas de producto`,
      metadata: { count: Array.isArray(deletedEntries) ? deletedEntries.length : 0 },
    });
    res.json({
      status: true,
      deletedEntries,
    });
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "entry.delete_products",
      sourceModule: "entry.controller",
      entityType: "entry",
      summary: "Falló la eliminación de entradas de producto",
    }, "failed", error);
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
    traceAction(res, {
      actionType: "entry.update",
      sourceModule: "entry.controller",
      sourceId: Array.isArray(entries) ? entries.map((entry: any) => String(entry?.id_ingreso || "")).filter(Boolean).join(",") : "",
      entityType: "entry",
      summary: `Se actualizaron ${entryUpdated.length} entradas`,
      metadata: { count: entryUpdated.length },
    });
    res.status(200).json({
      status: "success",
      message: `${entryUpdated.length} entries updated successfully`,
      data: entryUpdated
    });
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "entry.update",
      sourceModule: "entry.controller",
      sourceId: Array.isArray(entries) ? entries.map((entry: any) => String(entry?.id_ingreso || "")).filter(Boolean).join(",") : "",
      entityType: "entry",
      summary: "Falló la actualización de entradas",
      metadata: { count: Array.isArray(entries) ? entries.length : 0 },
    }, "failed", error);
    res.status(500).json({ msg: "Error updating entries", error });
  }
};

export const updateEntriesOfProducts = async (req: Request, res: Response) => {
  const entryData = req.body;
  try {
    const updatedEntries = await EntryService.updateProductEntries(entryData);
    traceAction(res, {
      actionType: "entry.update_products",
      sourceModule: "entry.controller",
      entityType: "entry",
      summary: `Se actualizaron ${Array.isArray(updatedEntries) ? updatedEntries.length : 0} entradas de producto`,
      metadata: { count: Array.isArray(updatedEntries) ? updatedEntries.length : 0 },
    });
    res.json({
      status: true,
      updatedEntries,
    });
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "entry.update_products",
      sourceModule: "entry.controller",
      entityType: "entry",
      summary: "Falló la actualización de entradas de producto",
    }, "failed", error);
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

    traceAction(res, {
      actionType: "entry.create",
      sourceModule: "entry.controller",
      sourceId: String(entry?._id || ""),
      entityType: "entry",
      entityId: String(entry?._id || ""),
      summary: `Se registró una entrada ${String(entry?._id || "")}`,
      metadata: {
        productId: String(entryData?.producto || ""),
        sellerId: String(entryData?.vendedor || producto.id_vendedor || ""),
        branchId: String(entryData?.sucursal || ""),
      },
    });

    res.json({
      status: true,
      entry,
    });

  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "entry.create",
      sourceModule: "entry.controller",
      entityType: "entry",
      summary: "Falló el registro de entrada",
      metadata: {
        productId: String(entryData?.producto || ""),
        sellerId: String(entryData?.vendedor || ""),
        branchId: String(entryData?.sucursal || ""),
      },
    }, "failed", error);
    res.status(500).json({ msg: "Error creating entry", error });
  }
};

