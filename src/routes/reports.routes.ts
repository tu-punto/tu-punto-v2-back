import { Router } from "express";
import {
  getOperacionMensual,
  exportOperacionMensualXlsx,
  exportStockProductosXlsx,
  getInventarioActual,
  exportInventarioActualXlsx,
  getProductosRiesgoVariantes,
  exportProductosRiesgoVariantesXlsx,
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
  getEntregasSimplesResumen,
} from "../controllers/reports.controller";

const reportsRouter = Router();

reportsRouter.post("/operacion-mensual", getOperacionMensual);

reportsRouter.get("/operacion-mensual/xlsx", exportOperacionMensualXlsx);
reportsRouter.get("/stock-productos/xlsx", exportStockProductosXlsx);
reportsRouter.post("/inventario-actual", getInventarioActual);
reportsRouter.get("/inventario-actual/xlsx", exportInventarioActualXlsx);
reportsRouter.get("/productos-variantes-riesgo", getProductosRiesgoVariantes);
reportsRouter.get("/productos-variantes-riesgo/xlsx", exportProductosRiesgoVariantesXlsx);
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
reportsRouter.get("/entregas-simples", getEntregasSimplesResumen);

export default reportsRouter;
