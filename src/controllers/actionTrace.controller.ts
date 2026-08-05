import { Request, Response } from "express";
import { ActionTraceService } from "../services/actionTrace.service";

export const listActionTracesController = async (req: Request, res: Response) => {
  try {
    const actionTypes = String(req.query.actionTypes || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const result = await ActionTraceService.listActionTraces({
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      status: String(req.query.status || "all"),
      actionType: String(req.query.actionType || ""),
      actionTypes,
      sourceModule: String(req.query.sourceModule || ""),
      entityType: String(req.query.entityType || ""),
      actorUserId: String(req.query.actorUserId || ""),
      actorRole: String(req.query.actorRole || ""),
      q: String(req.query.q || ""),
      from: String(req.query.from || ""),
      to: String(req.query.to || ""),
      order: req.query.order === "asc" ? "asc" : "desc",
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "No se pudo obtener la trazabilidad" });
  }
};

export const listActionTraceActorsController = async (_req: Request, res: Response) => {
  try {
    const rows = await ActionTraceService.listActionTraceActors();
    res.json({ success: true, rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "No se pudieron obtener los usuarios de trazabilidad" });
  }
};
