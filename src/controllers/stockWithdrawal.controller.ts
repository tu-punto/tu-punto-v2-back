import { Request, Response } from "express";
import { StockWithdrawalService } from "../services/stockWithdrawal.service";

const getAuth = (res: Response) =>
  (res.locals.auth as { id?: string; role?: string; sellerId?: string } | undefined) || {};

export const listStockWithdrawalRequests = async (req: Request, res: Response) => {
  try {
    const auth = getAuth(res);
    const rows = await StockWithdrawalService.listRequests({
      role: String(auth.role || ""),
      sellerId: String(auth.sellerId || ""),
      branchId: String(req.query.branchId || ""),
      status: String(req.query.status || "pending"),
    });
    res.json({ success: true, rows });
  } catch (error: any) {
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
    res.json({ success: true, request });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error?.message || "No se pudo crear la solicitud" });
  }
};

export const approveStockWithdrawalRequest = async (req: Request, res: Response) => {
  try {
    const auth = getAuth(res);
    const request = await StockWithdrawalService.approveRequest({
      requestId: req.params.id,
      userId: auth.id,
    });
    res.json({ success: true, request });
  } catch (error: any) {
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
    res.json({ success: true, request });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error?.message || "No se pudo rechazar la solicitud" });
  }
};
