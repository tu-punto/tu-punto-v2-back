import { FeatureService } from "./feature.service";
import { ShippingService } from "./shipping.service";
import { SaleRepository } from "../repositories/sale.repository";
import { IFinanceFluxDocument } from "../entities/documents/IFinanceFluxDocument";


const getFinancialSummary = async (startDate?: string, endDate?: string, sucursalId?: string) => {
  const features: IFinanceFluxDocument[] = await FeatureService.getAllFeaturesDashboard();

  const shippings = await ShippingService.getAllShippings(); 

  // FILTRO DE FECHAS
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  let ingresos = 0, gastos = 0, inversiones = 0;

  for (const f of features) {
    const fecha = new Date(f.fecha);
    if (start && fecha < start) continue;
    if (end && fecha > end) continue;

    if (f.tipo === "INGRESO") ingresos += f.monto || 0;
    else if (f.tipo === "GASTO") gastos += f.monto || 0;
    else if (f.tipo === "INVERSION") inversiones += f.monto || 0;
  }

  let montoCobradoDelivery = 0;
  let costoDelivery = 0;

  for (const s of shippings) {
    const fecha = new Date(s.hora_entrega_acordada);
    if (start && fecha < start) continue;
    if (end && fecha > end) continue;

    montoCobradoDelivery += s.cargo_delivery || 0;
    costoDelivery += s.costo_delivery || 0;
  }

  const balanceDelivery = montoCobradoDelivery - costoDelivery;

  // ----------------- VENTAS -----------------
  const sales = await SaleRepository.findAll(); // o crea un `findAllBetweenDates`

  let comision = 0;
  let mercaderiaVendida = 0;

  for (const v of sales) {
    const fechaVenta = new Date(v.fecha);
    if (start && fechaVenta < start) continue;
    if (end && fechaVenta > end) continue;

    comision += v.comision || 0;
    mercaderiaVendida += (v.cantidad || 1) * (v.precio_unitario || 0);
  }

  ingresos += comision; 
  const utilidad = ingresos - gastos + balanceDelivery;
  const caja = utilidad + inversiones;

  return {
    ingresos,
    gastos,
    balanceDelivery,
    inversiones,
    utilidad,
    caja,
    comision,
    mercaderiaVendida,
  };
};

export const DashboardService = {
  getFinancialSummary
};
