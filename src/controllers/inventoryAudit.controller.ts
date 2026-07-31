import { Request, Response } from "express";
import { InventoryAuditService } from "../services/inventoryAudit.service";

const parseDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseParams = (source: any) => ({
  from: parseDate(source?.from),
  to: parseDate(source?.to),
  sellerId: typeof source?.sellerId === "string" ? String(source.sellerId).trim() : undefined,
  productId: typeof source?.productId === "string" ? String(source.productId).trim() : undefined,
  branchId: typeof source?.branchId === "string" ? String(source.branchId).trim() : undefined,
  eventType: typeof source?.eventType === "string" ? String(source.eventType).trim() : undefined,
  actorUserId: typeof source?.actorUserId === "string" ? String(source.actorUserId).trim() : undefined,
  direction: typeof source?.direction === "string" ? String(source.direction).trim() : undefined,
  q: typeof source?.q === "string" ? String(source.q).trim() : undefined,
  page: Number(source?.page || 1),
  limit: Number(source?.limit || 20),
  order: (source?.order === "asc" ? "asc" : "desc") as "asc" | "desc",
});

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
  }
  return undefined;
};

export const listInventoryAuditMovements = async (req: Request, res: Response) => {
  try {
    const result = await InventoryAuditService.listMovements(parseParams(req.query));
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("listInventoryAuditMovements error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo obtener la auditoria de stock",
      error: error?.message || "Internal error",
    });
  }
};

export const getInventoryAuditEventDetail = async (req: Request, res: Response) => {
  try {
    const result = await InventoryAuditService.getEventDetail(String(req.params.id || "").trim());
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("getInventoryAuditEventDetail error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudo obtener el detalle de auditoria",
    });
  }
};

export const exportInventoryAuditXlsx = async (req: Request, res: Response) => {
  try {
    const { buffer, filename } = await InventoryAuditService.exportMovementsReport(parseParams(req.query));
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    return res.send(buffer);
  } catch (error: any) {
    console.error("exportInventoryAuditXlsx error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo exportar la auditoria de stock",
      error: error?.message || "Internal error",
    });
  }
};

export const updateInventoryAuditMovementResolved = async (req: Request, res: Response) => {
  try {
    const resolved = parseBoolean(req.body?.resolved);
    if (resolved === undefined) {
      return res.status(400).json({ success: false, message: "El valor de resuelto es inválido" });
    }

    const result = await InventoryAuditService.setMovementResolved(String(req.params.id || "").trim(), resolved);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("updateInventoryAuditMovementResolved error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudo actualizar el estado del movimiento",
    });
  }
};
