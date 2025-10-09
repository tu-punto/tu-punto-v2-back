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

const getFinancialSummary = async (startDate?: Date | null, endDate?: Date | null) => {
  const fluxes = await FinanceFluxRepository.findAll();
  const shippings = await ShippingService.getAllShippings();
  const sales = await SaleRepository.findAll();

  const isInRange = (date: Date) => {
    if (!startDate) return true;
    const end = endDate || new Date();
    return date >= startDate && date <= end;
  };

  const filteredFluxes = fluxes.filter(f => f.fecha && isInRange(new Date(f.fecha)));
  const filteredShippings = shippings.filter(s => s.fecha_pedido && isInRange(new Date(s.fecha_pedido)));
  const filteredSales = sales.filter(v => v.fecha && isInRange(new Date(v.fecha)));

  // --- VARIABLES ---
  let ingresos = 0;
  let gastos = 0;
  let inversiones = 0;
  let montoCobradoDelivery = 0;
  let costoDelivery = 0;
  let comision = 0;
  let mercaderiaVendida = 0;

  // --- FLUJOS FINANCIEROS (tabla Gastos e Ingresos) ---
  for (const f of filteredFluxes) {
    if (f.tipo === "INGRESO") ingresos += f.monto || 0;
    else if (f.tipo === "GASTO") gastos += f.monto || 0;
    else if (f.tipo === "INVERSION") inversiones += f.monto || 0;
  }

  // --- DELIVERY ---
  for (const s of filteredShippings) {
    montoCobradoDelivery += s.cargo_delivery || 0;
    costoDelivery += s.costo_delivery || 0;
  }
  const balanceDelivery = montoCobradoDelivery - costoDelivery;

  // --- COMISIONES Y MERCADERÍA ---
  for (const v of filteredSales) {
    let comisionVenta = v.comision;
    if (!comisionVenta) {
      const vendedor = v.vendedor || (await VendedorModel.findById(v.id_vendedor));
      const precioUnitario = v.precio_unitario || 0;
      const cantidad = v.cantidad || 1;
      const totalVenta = precioUnitario * cantidad;
      comisionVenta = 0;

      if (vendedor) {
        if (vendedor.comision_porcentual) {
          comisionVenta += totalVenta * (vendedor.comision_porcentual / 100);
        }
        if (vendedor.comision_fija) {
          comisionVenta += vendedor.comision_fija;
        }
      }
    }

    comision += comisionVenta || 0;
    mercaderiaVendida += (v.cantidad || 1) * (v.precio_unitario || 0);
  }

  // --- 💰 REGLAS DE NEGOCIO REALES ---
  ingresos += comision;               // agregar comisiones
  ingresos += montoCobradoDelivery;   // agregar ingresos delivery (externos)

  const utilidad = ingresos - gastos + balanceDelivery;
  const caja = inversiones + utilidad;

  return {
    ingresos,
    gastos,
    inversiones,
    balanceDelivery,
    utilidad,
    caja,
    comision,
    mercaderiaVendida,
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
};
