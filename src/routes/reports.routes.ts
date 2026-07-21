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
  getIngresosMensualesSucursalServicio,
  exportIngresosMensualesSucursalServicioXlsx,
  exportClientesActivosXlsx,
  getClientesActivos,
  exportVentasVendedores4mXlsx,
  getVentasVendedores,
  getVentasQr,
  exportVentasQrXlsx,
  exportClientesStatusXlsx,
  exportVendedoresPagosSucursalesXlsx,
  getEntregasSimplesResumen,
  exportEntregasSimplesResumenXlsx,
  getReporteEntregasSimplesExternas,
  exportReporteEntregasSimplesExternasXlsx,
  exportVentasTemporalesPorVendedorXlsx,
  getVentasTemporalesPorVendedor,
  getRiesgoClientesVentas,
  exportRiesgoClientesVentasXlsx,
} from "../controllers/reports.controller";
import {
  exportOrderAuditReportXlsx,
  getOrderAuditReport,
} from "../controllers/orderAuditReport.controller";
import { rateLimiters } from "../middlewares/rateLimit.middleware";
import { validateRequest } from "../middlewares/validate.middleware";
import {
  validateEntregasSimplesQuery,
  validateInventarioActualBody,
  validateInventarioActualQuery,
  validateMesesBody,
  validateMesesQuery,
  validateOperacionMensualBody,
  validateOperacionMensualQuery,
  validateProductosRiesgoQuery,
  validateReporteEntregasExternasQuery,
  validateStockProductosQuery,
  validateVentasQrBody,
  validateVentasQrQuery,
  validateVentasTemporalesQuery,
} from "../validation/reports.validation";

const reportsRouter = Router();

reportsRouter.use(rateLimiters.reports);

reportsRouter.post("/operacion-mensual", validateRequest({ body: validateOperacionMensualBody }), getOperacionMensual);

reportsRouter.get("/operacion-mensual/xlsx", validateRequest({ query: validateOperacionMensualQuery }), exportOperacionMensualXlsx);
reportsRouter.get("/stock-productos/xlsx", validateRequest({ query: validateStockProductosQuery }), exportStockProductosXlsx);
reportsRouter.post("/inventario-actual", validateRequest({ body: validateInventarioActualBody }), getInventarioActual);
reportsRouter.get("/inventario-actual/xlsx", validateRequest({ query: validateInventarioActualQuery }), exportInventarioActualXlsx);
reportsRouter.get("/productos-variantes-riesgo", validateRequest({ query: validateProductosRiesgoQuery }), getProductosRiesgoVariantes);
reportsRouter.get("/productos-variantes-riesgo/xlsx", validateRequest({ query: validateProductosRiesgoQuery }), exportProductosRiesgoVariantesXlsx);
reportsRouter.post("/comisiones", validateRequest({ body: validateMesesBody }), getComisionesMeses);
reportsRouter.get("/comisiones-3m/xlsx", validateRequest({ query: validateMesesQuery }), exportComisiones3MesesXlsx);
reportsRouter.post("/ingresos", validateRequest({ body: validateMesesBody }), getIngresosMeses);
reportsRouter.get("/ingresos-3m/xlsx", validateRequest({ query: validateMesesQuery }), exportIngresosFlujo3MesesXlsx);
reportsRouter.post("/ingresos-mensuales-sucursal-servicio", validateRequest({ body: validateMesesBody }), getIngresosMensualesSucursalServicio);
reportsRouter.get("/ingresos-mensuales-sucursal-servicio/xlsx", validateRequest({ query: validateMesesQuery }), exportIngresosMensualesSucursalServicioXlsx);
reportsRouter.post("/clientes-activos", validateRequest({ body: validateMesesBody }), getClientesActivos);
reportsRouter.get("/clientes-activos/xlsx", validateRequest({ query: validateMesesQuery }), exportClientesActivosXlsx);
reportsRouter.post("/ventas-vendedores", validateRequest({ body: validateMesesBody }), getVentasVendedores);
reportsRouter.post("/riesgo-clientes-ventas", validateRequest({ body: validateMesesBody }), getRiesgoClientesVentas);
reportsRouter.get("/riesgo-clientes-ventas/xlsx", validateRequest({ query: validateMesesQuery }), exportRiesgoClientesVentasXlsx);
reportsRouter.get("/ventas-vendedores-4m/xlsx", exportVentasVendedores4mXlsx);
reportsRouter.post("/ventas-qr", validateRequest({ body: validateVentasQrBody }), getVentasQr);
reportsRouter.get("/ventas-qr/xlsx", validateRequest({ query: validateVentasQrQuery }), exportVentasQrXlsx);
reportsRouter.get("/clientes-status/xlsx", exportClientesStatusXlsx);
reportsRouter.get("/vendedores-pagos-sucursales/xlsx", exportVendedoresPagosSucursalesXlsx);
reportsRouter.get("/entregas-simples", validateRequest({ query: validateEntregasSimplesQuery }), getEntregasSimplesResumen);
reportsRouter.get("/entregas-simples/xlsx", validateRequest({ query: validateEntregasSimplesQuery }), exportEntregasSimplesResumenXlsx);
reportsRouter.get("/reporte-entregas-simples-externas", validateRequest({ query: validateReporteEntregasExternasQuery }), getReporteEntregasSimplesExternas);
reportsRouter.get("/reporte-entregas-simples-externas/xlsx", validateRequest({ query: validateReporteEntregasExternasQuery }), exportReporteEntregasSimplesExternasXlsx);
reportsRouter.get("/ventas-temporales-vendedor", validateRequest({ query: validateVentasTemporalesQuery }), getVentasTemporalesPorVendedor);
reportsRouter.get("/ventas-temporales-vendedor/xlsx", validateRequest({ query: validateVentasTemporalesQuery }), exportVentasTemporalesPorVendedorXlsx);
reportsRouter.get("/auditoria-pedidos", getOrderAuditReport);
reportsRouter.get("/auditoria-pedidos/xlsx", exportOrderAuditReportXlsx);

export default reportsRouter;
