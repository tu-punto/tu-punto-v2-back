import { Request, Response } from "express";
import { ReportsService } from "../services/reports.service";

export const getOperacionMensual = async (req: Request, res: Response) => {
  try {
    const { mes, meses, sucursales, modoTop, reportes, columnas } = req.body || {};
    const sucursalIds = Array.isArray(sucursales) ? sucursales : undefined;
    const mesesArr = Array.isArray(meses)
      ? meses
      : (typeof meses === "string" ? meses.split(",").map((m: string) => m.trim()).filter(Boolean) : undefined);
    const modo = (modoTop === "vendedores" ? "vendedores" : "clientes") as "clientes"|"vendedores";

    const data = await ReportsService.getOperacionMensual({
      mes,
      meses: mesesArr,
      sucursalIds,
      modoTop: modo,
      reportes,
      columnas
    });

    res.json({ ok: true, ...data });
  } catch (err:any) {
    console.error("getOperacionMensual error:", err);
    res.status(500).json({ ok:false, msg:"Internal Error", error: err?.message });
  }
};
const SUCURSALES_REPORTE_3M = [
  "6859a22ce3356f061c43e151",
  "685a74a6ce20b0f8bf89d4f4",
  "685cfd09d42518781c3fa640",
  "685cfd2ad42518781c3fa643",
  "690a1bddee9c374b7a2fcfec",
];
export const exportOperacionMensualXlsx = async (req: Request, res: Response) => {
  try {
    const mes = String(req.query.mes || "");
    const mesesParam = typeof req.query.meses === "string" ? String(req.query.meses) : "";
    const mesesArr = mesesParam ? mesesParam.split(",").map(s => s.trim()).filter(Boolean) : undefined;
    const modoTop = (req.query.modoTop === "vendedores" ? "vendedores" : "clientes") as "clientes"|"vendedores";
    const sucursalesParam = typeof req.query.sucursales === "string" ? String(req.query.sucursales) : "";
    const sucursalIds = sucursalesParam ? sucursalesParam.split(",").map(s => s.trim()) : undefined;
    const reportesParam = typeof req.query.reportes === "string" ? String(req.query.reportes) : "";
    const reportes = reportesParam ? reportesParam.split(",").map(s => s.trim()).filter(Boolean) : undefined;
    const columnasRaw = typeof req.query.columnas === "string" ? String(req.query.columnas) : "";
    let columnas: Record<string, string[]> | undefined;
    if (columnasRaw) {
      try {
        columnas = JSON.parse(columnasRaw);
      } catch {
        columnas = undefined;
      }
    }

    const { filePath, filename } = await ReportsService.exportOperacionMensualXlsx({
      mes,
      meses: mesesArr,
      sucursalIds,
      modoTop,
      reportes,
      columnas
    });

    res.download(filePath, filename);
  } catch (err:any) {
    console.error("exportOperacionMensualXlsx error:", err);
    res.status(500).json({ ok:false, msg:"No se pudo generar el XLSX", error: err?.message });
  }
};
export const exportStockProductosXlsx = async (req: Request, res: Response) => {
  try {
    const idSucursal = String(req.query.idSucursal || "");
    if (!idSucursal) {
      return res.status(400).json({ ok: false, msg: "idSucursal es requerido" });
    }

    const { filePath, filename } = await ReportsService.exportStockProductosXlsx({ idSucursal });
    res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportStockProductosXlsx error:", err);
    res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
export const exportComisiones3MesesXlsx = async (req: Request, res: Response) => {
  try {
    const mesFin = String(req.query.mesFin || "");
    if (!mesFin) {
      return res.status(400).json({ ok: false, msg: "mesFin es requerido (YYYY-MM)" });
    }

    // Si te pasan sucursales por query, úsalo; si no, usa las fijas
    const sucursalesParam =
      typeof req.query.sucursales === "string" ? String(req.query.sucursales) : "";

    const sucursalIds =
      sucursalesParam.trim().length > 0
        ? sucursalesParam.split(",").map(s => s.trim()).filter(Boolean)
        : SUCURSALES_REPORTE_3M;

    const { filePath, filename } = await ReportsService.exportComisiones3MesesXlsx({
      mesFin,
      sucursalIds,
    });

    res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportComisiones3MesesXlsx error:", err);
    res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
  export const exportIngresosFlujo3MesesXlsx = async (req: Request, res: Response) => {
    try {
      const mesFin = String(req.query.mesFin || "");
      if (!mesFin || !/^\d{4}-\d{2}$/.test(mesFin)) {
        return res.status(400).json({ message: "mesFin es requerido y debe ser YYYY-MM" });
      }

      // opcional: incluir deuda
      const incluirDeuda = String(req.query.incluirDeuda || "false") === "true";

      const { filePath, filename } = await ReportsService.exportIngresosFlujo4MesesXlsx({
        mesFin,
        incluirDeuda,
      });

      return res.download(filePath, filename);
    } catch (err) {
      console.error("Error exportIngresosFlujo3MesesXlsx:", err);
      return res.status(500).json({ message: "Error al generar reporte de ingresos 3M" });
    }
  };
  export const exportClientesActivosXlsx = async (req: Request, res: Response) => {
  try {
    const mesFin = String(req.query.mesFin || "");
    if (!mesFin || !/^\d{4}-\d{2}$/.test(mesFin)) {
      return res.status(400).json({ ok:false, msg:"mesFin es requerido (YYYY-MM)" });
    }

    const { filePath, filename } = await ReportsService.exportClientesActivosXlsx({ mesFin });
    return res.download(filePath, filename);
  } catch (err:any) {
    console.error("exportClientesActivosXlsx error:", err);
    return res.status(500).json({ ok:false, msg:"No se pudo generar el XLSX", error: err?.message });
  }
};
export const exportVentasVendedores4mXlsx = async (req: Request, res: Response) => {
  try {
    const { filePath, filename } = await ReportsService.exportVentasVendedores4mXlsx();

    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportVentasVendedores4mXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
export const getVentasQr = async (req: Request, res: Response) => {
  try {
    const { meses, mes, sucursales } = req.body || {};
    const mesesArr = Array.isArray(meses)
      ? meses
      : (typeof meses === "string" ? meses.split(",").map((m: string) => m.trim()).filter(Boolean) : undefined);

    const sucursalIds = Array.isArray(sucursales) ? sucursales : undefined;

    const data = await ReportsService.getVentasQr({
      mes,
      meses: mesesArr,
      sucursalIds,
    });

    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getVentasQr error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};
export const exportVentasQrXlsx = async (req: Request, res: Response) => {
  try {
    const mesesParam = typeof req.query.meses === "string" ? String(req.query.meses) : "";
    const sucursalesParam = typeof req.query.sucursales === "string" ? String(req.query.sucursales) : "";

    const meses = mesesParam.split(",").map(s => s.trim()).filter(Boolean);
    const sucursalIds = sucursalesParam
      ? sucursalesParam.split(",").map(s => s.trim()).filter(Boolean)
      : undefined;

    const { filePath, filename } = await ReportsService.exportVentasQrXlsx({
      meses,
      sucursalIds,
    });

    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportVentasQrXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};

export const exportClientesStatusXlsx = async (_: Request, res: Response) => {
  try {
    const { filePath, filename } = await ReportsService.exportClientesStatusXlsx({});
    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportClientesStatusXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};



