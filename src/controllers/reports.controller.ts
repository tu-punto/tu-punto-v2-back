import { Request, Response } from "express";
import { ReportsService } from "../services/reports.service";

export const getOperacionMensual = async (req: Request, res: Response) => {
  try {
    const { mes, sucursales, modoTop } = req.body || {};
    const sucursalIds = Array.isArray(sucursales) ? sucursales : undefined;
    const modo = (modoTop === "vendedores" ? "vendedores" : "clientes") as "clientes"|"vendedores";

    const data = await ReportsService.getOperacionMensual({
      mes,
      sucursalIds,
      modoTop: modo
    });

    res.json({ ok: true, ...data });
  } catch (err:any) {
    console.error("getOperacionMensual error:", err);
    res.status(500).json({ ok:false, msg:"Internal Error", error: err?.message });
  }
};

export const exportOperacionMensualXlsx = async (req: Request, res: Response) => {
  try {
    const mes = String(req.query.mes || "");
    const modoTop = (req.query.modoTop === "vendedores" ? "vendedores" : "clientes") as "clientes"|"vendedores";
    const sucursalesParam = typeof req.query.sucursales === "string" ? String(req.query.sucursales) : "";
    const sucursalIds = sucursalesParam ? sucursalesParam.split(",").map(s => s.trim()) : undefined;

    const { filePath, filename } = await ReportsService.exportOperacionMensualXlsx({
      mes,
      sucursalIds,
      modoTop
    });

    res.download(filePath, filename);
  } catch (err:any) {
    console.error("exportOperacionMensualXlsx error:", err);
    res.status(500).json({ ok:false, msg:"No se pudo generar el XLSX", error: err?.message });
  }
};
