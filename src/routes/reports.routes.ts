import { Router } from "express";
import {
  getOperacionMensual,
  exportOperacionMensualXlsx
} from "../controllers/reports.controller";

const reportsRouter = Router();

/**
 * POST /reports/operacion-mensual
 * body: { mes: "YYYY-MM", sucursales?: string[], modoTop?: "clientes"|"vendedores" }
 */
reportsRouter.post("/operacion-mensual", getOperacionMensual);

/**
 * GET /reports/operacion-mensual/xlsx?mes=YYYY-MM&modoTop=clientes&sucursales=ID1,ID2
 * descarga el XLSX con 7 hojas
 */
reportsRouter.get("/operacion-mensual/xlsx", exportOperacionMensualXlsx);

export default reportsRouter;
