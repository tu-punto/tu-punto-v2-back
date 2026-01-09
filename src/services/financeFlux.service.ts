import { VendedorSchema } from './../entities/implements/VendedorSchema';
import { Types } from "mongoose";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { SellerRepository } from "../repositories/seller.repository";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { WorkerRepository } from "../repositories/worker.repository";
import { FinanceFluxInteractor } from "../interactors/financeFlux.interactor";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";
import { SaleRepository } from "../repositories/sale.repository";
import { ShippingService } from "./shipping.service";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { ExternalSaleRepository } from "../repositories/external.repository";

const assertFlux = (flux: IFlujoFinanciero | null) => {
  if (!flux) throw new Error("Flux not found");
};

const getAllFinanceFluxes = async () => await FinanceFluxRepository.findAll();

const getDebts = async () => await FinanceFluxRepository.findAllDebts();

const registerFinanceFlux = async (flux: IFlujoFinanciero) => {
  let montoFinal = flux.monto;

  if (flux.tipo === "INGRESO" && flux.id_vendedor) {
    const vendedor = await SellerRepository.findById(flux.id_vendedor);
    if (vendedor && vendedor.comision_porcentual) {
      const extra = flux.monto * (vendedor.comision_porcentual / 100);
      montoFinal += extra;
    }
  }

  await FinanceFluxRepository.registerFinanceFlux({
    ...flux,
    monto: montoFinal,
  });
};

const payDebt = async (fluxId: string) => {
  const _id = new Types.ObjectId(fluxId);
  const flux = await FinanceFluxRepository.findById(_id);
  assertFlux(flux);
  if (!flux!.esDeuda) throw new Error("Este flujo no es una deuda");

  await FinanceFluxRepository.updateById(fluxId, { esDeuda: false });

  await SellerRepository.incrementDebt(
    flux!.vendedor!.toString(),
    -flux!.monto
  );
};

const getWorkerById = async (workerId: any) => {
  const flux = await FinanceFluxRepository.findWorkerById(workerId);
  assertFlux(flux);

  const worker = flux!.trabajador as ITrabajador;
  if (!worker) throw new Error("No worker found");

  return { id_trabajador: worker.id_trabajador, nombre: worker.nombre };
};

const getSellerById = async (sellerId: any) => {
  const flux = await FinanceFluxRepository.findSellerById(sellerId);
  assertFlux(flux);

  const sData = flux!.vendedor as IVendedor;
  const seller = await SellerRepository.findById(sData.id_vendedor);
  if (!seller) throw new Error("No seller found");

  return {
    id_vendedor: seller.id_vendedor,
    nombre: seller.nombre,
    apellido: seller.apellido,
    marca: seller.marca,
  };
};

const getSellerInfoById = async (id: any) =>
  await FinanceFluxRepository.findSellerInfoById(id);

const getStatsService = async () => {
  const stats = await FinanceFluxInteractor.getStatsInteractor();
  if (!stats) throw new Error("Failed to get stats");
  return stats;
};

const updateFinanceFlux = async (
  fluxId: string,
  updates: Partial<IFlujoFinanciero>
) => {
  const _id = new Types.ObjectId(fluxId);

  const existingFlux = await FinanceFluxRepository.findById(_id);
  if (!existingFlux) throw new Error("Flujo no encontrado");

  const oldDeuda = existingFlux.esDeuda ? existingFlux.monto : 0;

  const updatedFlux = await FinanceFluxRepository.updateById(fluxId, updates);
  if (!updatedFlux) throw new Error("Error al actualizar el flujo");

  const newDeuda = updatedFlux.esDeuda ? updatedFlux.monto : 0;
  const diff = newDeuda - oldDeuda;

  if (diff !== 0 && updatedFlux.id_vendedor) {
    await SellerRepository.incrementDebt(
      updatedFlux.id_vendedor.toString(),
      diff
    );
  }

  return updatedFlux;
};

type CommissionRange = {
  range?: string;
  from?: string;
  to?: string;
};

const parseRangeToDates = ({ range, from, to }: CommissionRange): { fromDate?: Date; toDate?: Date } => {
  const now = new Date();
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

  const norm = (range || '').toLowerCase();
  if (norm === 'all' || norm === 'todo' || norm === 'alltime') {
    return { fromDate: undefined, toDate: undefined };
  }
  const daysMap: Record<string, number> = { '7': 7, '7d': 7, '30': 30, '30d': 30, '90': 90, '90d': 90 };
  if (norm in daysMap) {
    toDate = endOfDay(now);
    const d = new Date(now);
    d.setDate(d.getDate() - daysMap[norm]);
    fromDate = startOfDay(d);
    return { fromDate, toDate };
  }

  if (norm === 'custom' || (from || to)) {
    if (from) {
      const f = new Date(from);
      if (!isNaN(f.getTime())) fromDate = startOfDay(f);
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t.getTime())) toDate = endOfDay(t);
    }
    return { fromDate, toDate };
  }

  // Default: all time
  return { fromDate: undefined, toDate: undefined };
};

const getCommissionTotal = async (opts: CommissionRange) => {
  const { fromDate, toDate } = parseRangeToDates(opts);
  const sales = await SaleRepository.findByPedidoDateRange(fromDate, toDate);

  let total = 0;
  for (const v of sales) {
    let comisionVenta = (v as any).comision as number | undefined;
    if (!comisionVenta) {
      const vendedor = (v as any).vendedor || (await VendedorModel.findById((v as any).id_vendedor));
      const precioUnitario = (v as any).precio_unitario || 0;
      const cantidad = (v as any).cantidad || 1;
      const totalVenta = precioUnitario * cantidad;
      comisionVenta = 0;
      if (vendedor) {
        if (typeof vendedor.comision_porcentual === 'number' && vendedor.comision_porcentual > 0) {
          comisionVenta += totalVenta * (vendedor.comision_porcentual / 100);
        }
        if (typeof vendedor.comision_fija === 'number' && vendedor.comision_fija > 0) {
          comisionVenta += vendedor.comision_fija;
        }
      }
    }
    total += comisionVenta || 0;
  }

  return { comision: total };
};

const getMerchandiseSoldTotal = async (opts: CommissionRange) => {
  const { fromDate, toDate } = parseRangeToDates(opts);
  const sales = await SaleRepository.findByPedidoDateRange(fromDate, toDate);

  let total = 0;
  for (const v of sales) {
    const cantidad = (v as any).cantidad || 0;
    const precio = (v as any).precio_unitario || 0;
    total += cantidad * precio;
  }

  return { mercaderiaVendida: total };
};

const getFinancialSummary = async () => {
  const fluxes = await FinanceFluxRepository.findAll();

  const shippings = await ShippingService.getAllShippings();

  const sales = await SaleRepository.findAll();

  const externalSales = await ExternalSaleRepository.getAllExternalSales();

  let ingresosFluxes = 0;
  let gastos = 0;
  let inversiones = 0;
  let montoCobradoDelivery = 0;
  let costoDelivery = 0;
  let comision = 0;
  let ingresosEntregasExternas = 0;

  for (const f of fluxes) {
    if (f.tipo === "INGRESO") ingresosFluxes += f.monto || 0;
    else if (f.tipo === "GASTO") gastos += f.monto || 0;
    else if (f.tipo === "INVERSION") inversiones += f.monto || 0;
  }

  for (const s of shippings) {
    montoCobradoDelivery += s.cargo_delivery || 0;
    costoDelivery += s.costo_delivery || 0;
  }
  const balanceDelivery = montoCobradoDelivery - costoDelivery;

  for (const v of sales) {
    let comisionVenta = v.comision;
    if (!comisionVenta) {
      // Calcula la comisión si no está guardada
      const vendedor = v.vendedor || (await VendedorModel.findById(v.id_vendedor));
      const precioUnitario = v.precio_unitario || 0;
      const cantidad = v.cantidad || 1;
      const totalVenta = precioUnitario * cantidad;
      comisionVenta = 0;
      if (vendedor) {
        if (typeof vendedor.comision_porcentual === 'number' && vendedor.comision_porcentual > 0) {
          comisionVenta += totalVenta * (vendedor.comision_porcentual / 100);
        }
        if (typeof vendedor.comision_fija === 'number' && vendedor.comision_fija > 0) {
          comisionVenta += vendedor.comision_fija;
        }
      }
    }
    comision += comisionVenta || 0;
  }

  // Suma ingresos por entregas externas
  for (const e of externalSales) {
    ingresosEntregasExternas += e.precio_total || 0;
  }

  // Ingresos = Flujos INGRESO + Comisiones + Ingresos por entregas externas
  const ingresos = ingresosFluxes + comision + ingresosEntregasExternas;

  // Utilidad = Ingresos - Gastos + Balance Delivery
  const utilidad = ingresos - gastos + balanceDelivery;

  // Caja = Inversión + Utilidad
  const caja = inversiones + utilidad;

  return {
    ingresos,
    gastos,
    inversiones,
    balanceDelivery,
    utilidad,
    caja
  };
};

export const FinanceFluxService = {
  getAllFinanceFluxes,
  registerFinanceFlux,
  payDebt,
  getWorkerById,
  getSellerById,
  getSellerInfoById,
  getStatsService,
  updateFinanceFlux,
  getFinancialSummary,
  getDebts,
  getCommissionTotal,
  getMerchandiseSoldTotal,
};
