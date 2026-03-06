import { Router } from "express";
import {
  getOperacionMensual,
  exportOperacionMensualXlsx,
  exportStockProductosXlsx,
  exportComisiones3MesesXlsx,
  getComisionesMeses,
  exportIngresosFlujo3MesesXlsx,
  getIngresosMeses,
  exportClientesActivosXlsx,
  getClientesActivos,
  exportVentasVendedores4mXlsx,
  getVentasVendedores,
  getVentasQr,
  exportVentasQrXlsx,
  exportClientesStatusXlsx,
} from "../controllers/reports.controller";

const reportsRouter = Router();

reportsRouter.post("/operacion-mensual", getOperacionMensual);

reportsRouter.get("/operacion-mensual/xlsx", exportOperacionMensualXlsx);
reportsRouter.get("/stock-productos/xlsx", exportStockProductosXlsx);
reportsRouter.post("/comisiones", getComisionesMeses);
reportsRouter.get("/comisiones-3m/xlsx", exportComisiones3MesesXlsx);
reportsRouter.post("/ingresos", getIngresosMeses);
reportsRouter.get("/ingresos-3m/xlsx", exportIngresosFlujo3MesesXlsx);
reportsRouter.post("/clientes-activos", getClientesActivos);
reportsRouter.get("/clientes-activos/xlsx", exportClientesActivosXlsx);
reportsRouter.post("/ventas-vendedores", getVentasVendedores);
reportsRouter.get("/ventas-vendedores-4m/xlsx", exportVentasVendedores4mXlsx);
reportsRouter.post("/ventas-qr", getVentasQr);
reportsRouter.get("/ventas-qr/xlsx", exportVentasQrXlsx);
reportsRouter.get("/clientes-status/xlsx", exportClientesStatusXlsx);

export default reportsRouter;
