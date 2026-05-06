import { Request, Response } from "express";
import { ReportsService } from "../services/reports.service";

export const getOperacionMensual = async (req: Request, res: Response) => {
  try {
    const { mes, meses, sucursales, modoTop, ticketPromedioModo, reportes, columnas } = req.body || {};
    const sucursalIds = Array.isArray(sucursales) ? sucursales : undefined;
    const mesesArr = Array.isArray(meses)
      ? meses
      : (typeof meses === "string" ? meses.split(",").map((m: string) => m.trim()).filter(Boolean) : undefined);
    const modo = (modoTop === "vendedores" ? "vendedores" : "clientes") as "clientes"|"vendedores";
    const ticketMode =
      ticketPromedioModo === "comision" || ticketPromedioModo === "pago_fijo_mas_comision"
        ? ticketPromedioModo
        : "pago_fijo";

    const data = await ReportsService.getOperacionMensual({
      mes,
      meses: mesesArr,
      sucursalIds,
      modoTop: modo,
      ticketPromedioModo: ticketMode,
      reportes,
      columnas
    });

    res.json({ ok: true, ...data });
  } catch (err:any) {
    console.error("getOperacionMensual error:", err);
    res.status(500).json({ ok:false, msg:"Internal Error", error: err?.message });
  }
};
const parseMesesInput = (source: any) => {
  const mes = typeof source?.mes === "string" ? String(source.mes) : undefined;
  const mesesRaw = source?.meses;
  const meses = Array.isArray(mesesRaw)
    ? mesesRaw
    : (typeof mesesRaw === "string" ? mesesRaw.split(",").map((m: string) => m.trim()).filter(Boolean) : undefined);

  return { mes, meses };
};

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const parseNumberArrayInput = (value: unknown) => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  return raw
    .map((item) => {
      const direct = Number(item);
      if (Number.isInteger(direct) && direct >= 1 && direct <= 12) return direct;
      return MONTH_NAME_TO_NUMBER[String(item).trim().toLowerCase()];
    })
    .filter((item): item is number => Number.isInteger(item) && item >= 1 && item <= 12);
};

const parseStringArrayInput = (value: unknown) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return undefined;
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
    const ticketPromedioModo: "pago_fijo" | "comision" | "pago_fijo_mas_comision" =
      req.query.ticketPromedioModo === "comision" || req.query.ticketPromedioModo === "pago_fijo_mas_comision"
        ? (String(req.query.ticketPromedioModo) as "comision" | "pago_fijo_mas_comision")
        : "pago_fijo";
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
      ticketPromedioModo,
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
export const getInventarioActual = async (req: Request, res: Response) => {
  try {
    const idSucursal = String(req.body?.idSucursal || "").trim();
    const sellerId = typeof req.body?.sellerId === "string" ? String(req.body.sellerId).trim() : undefined;

    if (!idSucursal) {
      return res.status(400).json({ ok: false, msg: "idSucursal es requerido" });
    }

    const data = await ReportsService.getInventarioActual({ idSucursal, sellerId });
    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getInventarioActual error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};
export const exportInventarioActualXlsx = async (req: Request, res: Response) => {
  try {
    const idSucursal = String(req.query.idSucursal || "").trim();
    const sellerId = typeof req.query.sellerId === "string" ? String(req.query.sellerId).trim() : undefined;

    if (!idSucursal) {
      return res.status(400).json({ ok: false, msg: "idSucursal es requerido" });
    }

    const { filePath, filename } = await ReportsService.exportInventarioActualXlsx({ idSucursal, sellerId });
    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportInventarioActualXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
export const getProductosRiesgoVariantes = async (req: Request, res: Response) => {
  try {
    const sellerId =
      typeof req.query.sellerId === "string" ? String(req.query.sellerId).trim() : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const minCombinaciones =
      typeof req.query.minCombinaciones === "string"
        ? Number(req.query.minCombinaciones)
        : undefined;
    const minEspacioTeorico =
      typeof req.query.minEspacioTeorico === "string"
        ? Number(req.query.minEspacioTeorico)
        : undefined;

    const data = await ReportsService.getProductosRiesgoVariantes({
      sellerId,
      limit,
      minCombinaciones,
      minEspacioTeorico,
    });

    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getProductosRiesgoVariantes error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};
export const exportProductosRiesgoVariantesXlsx = async (req: Request, res: Response) => {
  try {
    const sellerId =
      typeof req.query.sellerId === "string" ? String(req.query.sellerId).trim() : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const minCombinaciones =
      typeof req.query.minCombinaciones === "string"
        ? Number(req.query.minCombinaciones)
        : undefined;
    const minEspacioTeorico =
      typeof req.query.minEspacioTeorico === "string"
        ? Number(req.query.minEspacioTeorico)
        : undefined;

    const { filePath, filename } = await ReportsService.exportProductosRiesgoVariantesXlsx({
      sellerId,
      limit,
      minCombinaciones,
      minEspacioTeorico,
    });

    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportProductosRiesgoVariantesXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
export const exportComisiones3MesesXlsx = async (req: Request, res: Response) => {
  try {
    const { mes, meses } = parseMesesInput(req.query);
    const mesFin = String(req.query.mesFin || "");

    // Si te pasan sucursales por query, úsalo; si no, usa las fijas
    const sucursalesParam =
      typeof req.query.sucursales === "string" ? String(req.query.sucursales) : "";

    const sucursalIds =
      sucursalesParam.trim().length > 0
        ? sucursalesParam.split(",").map(s => s.trim()).filter(Boolean)
        : SUCURSALES_REPORTE_3M;

    const { filePath, filename } = await ReportsService.exportComisionesMesesXlsx({
      mes,
      meses,
      mesFin,
      sucursalIds,
    });

    res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportComisiones3MesesXlsx error:", err);
    res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
export const getComisionesMeses = async (req: Request, res: Response) => {
  try {
    const { mes, meses } = parseMesesInput(req.body || {});
    const sucursalIds = Array.isArray(req.body?.sucursales) ? req.body.sucursales : undefined;
    const data = await ReportsService.getComisionesPorMeses({ mes, meses, sucursalIds });
    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getComisionesMeses error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};
  export const exportIngresosFlujo3MesesXlsx = async (req: Request, res: Response) => {
    try {
      const { mes, meses } = parseMesesInput(req.query);
      const mesFin = String(req.query.mesFin || "");

      // opcional: incluir deuda
      const incluirDeuda = String(req.query.incluirDeuda || "false") === "true";

      const { filePath, filename } = await ReportsService.exportIngresosMesesXlsx({
        mes,
        meses,
        mesFin,
        incluirDeuda,
      });

      return res.download(filePath, filename);
    } catch (err) {
      console.error("Error exportIngresosFlujo3MesesXlsx:", err);
      return res.status(500).json({ message: "Error al generar reporte de ingresos 3M" });
    }
  };
  export const getIngresosMeses = async (req: Request, res: Response) => {
    try {
      const { mes, meses } = parseMesesInput(req.body || {});
      const mesFin = String(req.body?.mesFin || "");
      const incluirDeuda = !!req.body?.incluirDeuda;
      const data = await ReportsService.getIngresosPorMeses({ mes, meses, mesFin, incluirDeuda });
      return res.json({ ok: true, ...data });
    } catch (err: any) {
      console.error("getIngresosMeses error:", err);
      return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
    }
  };
  export const exportClientesActivosXlsx = async (req: Request, res: Response) => {
  try {
    const { mes, meses } = parseMesesInput(req.query);
    const mesFin = String(req.query.mesFin || "");

    const { filePath, filename } = await ReportsService.exportClientesActivosMesesXlsx({ mes, meses, mesFin });
    return res.download(filePath, filename);
  } catch (err:any) {
    console.error("exportClientesActivosXlsx error:", err);
    return res.status(500).json({ ok:false, msg:"No se pudo generar el XLSX", error: err?.message });
  }
};
export const getClientesActivos = async (req: Request, res: Response) => {
  try {
    const { mes, meses } = parseMesesInput(req.body || {});
    const mesFin = String(req.body?.mesFin || "");
    const data = await ReportsService.getClientesActivosServicio({ mes, meses, mesFin });
    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getClientesActivos error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};
export const exportVentasVendedores4mXlsx = async (req: Request, res: Response) => {
  try {
    const { mes, meses } = parseMesesInput(req.query);
    const mesFin = String(req.query.mesFin || "");
    const { filePath, filename } = await ReportsService.exportVentasVendedoresMesesXlsx({ mes, meses, mesFin });

    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportVentasVendedores4mXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
export const getVentasVendedores = async (req: Request, res: Response) => {
  try {
    const { mes, meses } = parseMesesInput(req.body || {});
    const mesFin = String(req.body?.mesFin || "");
    const data = await ReportsService.getVentasVendedoresPorMeses({ mes, meses, mesFin });
    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getVentasVendedores error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
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

export const exportVendedoresPagosSucursalesXlsx = async (_: Request, res: Response) => {
  try {
    const { filePath, filename } = await ReportsService.exportVendedoresPagosSucursalesXlsx();
    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportVendedoresPagosSucursalesXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};

export const getEntregasSimplesResumen = async (req: Request, res: Response) => {
  try {
    const sellerId = typeof req.query?.sellerId === "string" ? String(req.query.sellerId).trim() : "";
    const sellerIdsFromQuery = parseStringArrayInput(req.query?.sellerIds);
    const meses = parseStringArrayInput(req.query?.meses);
    const sellerIds = sellerId ? [sellerId] : sellerIdsFromQuery;
    const data = await ReportsService.getEntregasSimplesResumen({ sellerIds, meses });
    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getEntregasSimplesResumen error:", err);
    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};

export const exportEntregasSimplesResumenXlsx = async (req: Request, res: Response) => {
  try {
    const sellerId = typeof req.query?.sellerId === "string" ? String(req.query.sellerId).trim() : "";
    const sellerIdsFromQuery = parseStringArrayInput(req.query?.sellerIds);
    const meses = parseStringArrayInput(req.query?.meses);
    const sellerIds = sellerId ? [sellerId] : sellerIdsFromQuery;
    const { filePath, filename } = await ReportsService.exportEntregasSimplesResumenXlsx({
      sellerIds,
      meses,
    });
    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportEntregasSimplesResumenXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};

export const exportReporteEntregasSimplesExternasXlsx = async (req: Request, res: Response) => {
  try {
    const mes = typeof req.query?.mes === "string" ? String(req.query.mes).trim() : "";
    const meses = parseStringArrayInput(req.query?.meses) || [];
    const sucursalIds = parseStringArrayInput(req.query?.sucursales);

    if (!mes && !meses.length) {
      return res.status(400).json({ ok: false, msg: "mes o meses es requerido" });
    }

    const { filePath, filename } = await ReportsService.exportReporteEntregasSimplesExternasXlsx({
      mes,
      meses,
      sucursalIds,
    });
    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportReporteEntregasSimplesExternasXlsx error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};

export const getReporteEntregasSimplesExternas = async (req: Request, res: Response) => {
  try {
    const mes = typeof req.query?.mes === "string" ? String(req.query.mes).trim() : "";
    const meses = parseStringArrayInput(req.query?.meses) || [];
    const sucursalIds = parseStringArrayInput(req.query?.sucursales);

    if (!mes && !meses.length) {
      return res.status(400).json({ ok: false, msg: "mes o meses es requerido" });
    }

    const data = await ReportsService.getReporteEntregasSimplesExternas({
      mes,
      meses,
      sucursalIds,
    });
    return res.json(data);
  } catch (err: any) {
    console.error("getReporteEntregasSimplesExternas error:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo generar la vista previa", error: err?.message });
  }
};

export const getVentasTemporalesPorVendedor = async (req: Request, res: Response) => {
  try {
    const sellerId = typeof req.query?.sellerId === "string" ? String(req.query.sellerId).trim() : "";

    if (!sellerId) {
      return res.status(400).json({ ok: false, msg: "sellerId es requerido" });
    }

    const data = await ReportsService.getVentasTemporalesPorVendedor({ sellerId });
    return res.json({ ok: true, ...data });
  } catch (err: any) {
    console.error("getVentasTemporalesPorVendedor error:", err);

    if (err?.message === "sellerId inválido") {
      return res.status(400).json({ ok: false, msg: err.message });
    }

    if (err?.message === "Vendedor no encontrado") {
      return res.status(404).json({ ok: false, msg: err.message });
    }

    return res.status(500).json({ ok: false, msg: "Internal Error", error: err?.message });
  }
};

export const exportVentasTemporalesPorVendedorXlsx = async (req: Request, res: Response) => {
  try {
    const sellerId = typeof req.query?.sellerId === "string" ? String(req.query.sellerId).trim() : "";

    if (!sellerId) {
      return res.status(400).json({ ok: false, msg: "sellerId es requerido" });
    }

    const { filePath, filename } = await ReportsService.exportVentasTemporalesPorVendedorXlsx({ sellerId });
    return res.download(filePath, filename);
  } catch (err: any) {
    console.error("exportVentasTemporalesPorVendedorXlsx error:", err);

    if (err?.message === "sellerId inválido" || err?.message === "sellerId invÃ¡lido") {
      return res.status(400).json({ ok: false, msg: err.message });
    }

    if (err?.message === "Vendedor no encontrado") {
      return res.status(404).json({ ok: false, msg: err.message });
    }

    return res.status(500).json({ ok: false, msg: "No se pudo generar el XLSX", error: err?.message });
  }
};
