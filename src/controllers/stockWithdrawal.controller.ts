import { Request, Response } from "express";
import { StockWithdrawalService } from "../services/stockWithdrawal.service";
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

const getAuth = (res: Response) =>
  (res.locals.auth as { id?: string; role?: string; sellerId?: string; email?: string } | undefined) || {};

export const listStockWithdrawalRequests = async (req: Request, res: Response) => {
  try {
    const auth = getAuth(res);
    const rows = await StockWithdrawalService.listRequests({
      role: String(auth.role || ""),
      sellerId: String(auth.sellerId || ""),
      branchId: String(req.query.branchId || ""),
      status: String(req.query.status || "pending"),
    });
    traceAction(res, {
      actionType: "stock_withdrawal.list",
      sourceModule: "stockWithdrawal.controller",
      summary: "Se consultaron solicitudes de retiro de stock",
      metadata: { status: String(req.query.status || "pending") },
    });
    res.json({ success: true, rows });
  } catch (error: any) {
    traceAction(res, {
      actionType: "stock_withdrawal.list",
      sourceModule: "stockWithdrawal.controller",
      summary: "Falló la consulta de solicitudes de retiro de stock",
    }, "failed", error);
    res.status(400).json({ success: false, message: error?.message || "No se pudieron obtener solicitudes" });
  }
};

export const createStockWithdrawalRequest = async (req: Request, res: Response) => {
  try {
    const auth = getAuth(res);
    const sellerId = String(auth.sellerId || req.body?.sellerId || "");
    const request = await StockWithdrawalService.createRequest({
      sellerId,
      userId: auth.id,
      branchId: req.body?.branchId,
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      comment: req.body?.comment,
    });
    traceAction(res, {
      actionType: "stock_withdrawal.create_request",
      sourceModule: "stockWithdrawal.controller",
      sourceId: String(request?._id || request?.id || ""),
      entityType: "stock_withdrawal_request",
      entityId: String(request?._id || request?.id || ""),
      summary: "Se creó una solicitud de retiro de stock",
      metadata: { itemCount: Array.isArray(req.body?.items) ? req.body.items.length : 0 },
    });
    res.json({ success: true, request });
  } catch (error: any) {
    traceAction(res, {
      actionType: "stock_withdrawal.create_request",
      sourceModule: "stockWithdrawal.controller",
      entityType: "stock_withdrawal_request",
      summary: "Falló la creación de una solicitud de retiro de stock",
    }, "failed", error);
    res.status(400).json({ success: false, message: error?.message || "No se pudo crear la solicitud" });
  }
};

export const approveStockWithdrawalRequest = async (req: Request, res: Response) => {
  try {
    const auth = getAuth(res);
    const request = await StockWithdrawalService.approveRequest({
      requestId: req.params.id,
      userId: auth.id,
      auditActor: {
        userId: String(auth.id || "").trim() || undefined,
        role: String(auth.role || "").trim() || undefined,
        name: String(auth.email || "").trim() || undefined,
        sellerId: String(auth.sellerId || "").trim() || undefined,
      },
    });
    traceAction(res, {
      actionType: "stock_withdrawal.approve_request",
      sourceModule: "stockWithdrawal.controller",
      sourceId: String(req.params.id || ""),
      entityType: "stock_withdrawal_request",
      entityId: String(req.params.id || ""),
      summary: "Se aprobó una solicitud de retiro de stock",
    });
    res.json({ success: true, request });
  } catch (error: any) {
    traceAction(res, {
      actionType: "stock_withdrawal.approve_request",
      sourceModule: "stockWithdrawal.controller",
      sourceId: String(req.params.id || ""),
      entityType: "stock_withdrawal_request",
      entityId: String(req.params.id || ""),
      summary: "Falló la aprobación de una solicitud de retiro de stock",
    }, "failed", error);
    res.status(400).json({ success: false, message: error?.message || "No se pudo aprobar la solicitud" });
  }
};

export const rejectStockWithdrawalRequest = async (req: Request, res: Response) => {
  try {
    const auth = getAuth(res);
    const request = await StockWithdrawalService.rejectRequest({
      requestId: req.params.id,
      userId: auth.id,
      reason: req.body?.reason,
    });
    traceAction(res, {
      actionType: "stock_withdrawal.reject_request",
      sourceModule: "stockWithdrawal.controller",
      sourceId: String(req.params.id || ""),
      entityType: "stock_withdrawal_request",
      entityId: String(req.params.id || ""),
      summary: "Se rechazó una solicitud de retiro de stock",
    });
    res.json({ success: true, request });
  } catch (error: any) {
    traceAction(res, {
      actionType: "stock_withdrawal.reject_request",
      sourceModule: "stockWithdrawal.controller",
      sourceId: String(req.params.id || ""),
      entityType: "stock_withdrawal_request",
      entityId: String(req.params.id || ""),
      summary: "Falló el rechazo de una solicitud de retiro de stock",
    }, "failed", error);
    res.status(400).json({ success: false, message: error?.message || "No se pudo rechazar la solicitud" });
  }
};
