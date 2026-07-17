import { Request, Response } from "express";
import { OrderAuditReportService } from "../services/orderAuditReport.service";

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "si" || normalized === "yes";
};

const parseDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseParams = (source: any) => ({
  from: parseDate(source?.from),
  to: parseDate(source?.to),
  branchId: typeof source?.branchId === "string" ? String(source.branchId).trim() : undefined,
  currentBranchId:
    typeof source?.currentBranchId === "string" ? String(source.currentBranchId).trim() : undefined,
  suspiciousOnly: parseBoolean(source?.suspiciousOnly),
});

export const getOrderAuditReport = async (req: Request, res: Response) => {
  try {
    const data = await OrderAuditReportService.getOrderAuditReport(parseParams(req.query));
    res.json({ ok: true, ...data });
  } catch (error: any) {
    console.error("getOrderAuditReport error:", error);
    res.status(500).json({
      ok: false,
      msg: "No se pudo generar la auditoria de pedidos",
      error: error?.message || "Internal error",
    });
  }
};

export const exportOrderAuditReportXlsx = async (req: Request, res: Response) => {
  try {
    const { filePath, filename } = await OrderAuditReportService.exportOrderAuditReportXlsx(
      parseParams(req.query)
    );
    res.download(filePath, filename);
  } catch (error: any) {
    console.error("exportOrderAuditReportXlsx error:", error);
    res.status(500).json({
      ok: false,
      msg: "No se pudo exportar la auditoria de pedidos",
      error: error?.message || "Internal error",
    });
  }
};
