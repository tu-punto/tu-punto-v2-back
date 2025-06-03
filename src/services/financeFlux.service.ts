import { Types } from "mongoose";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { SellerRepository } from "../repositories/seller.repository";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { WorkerRepository } from "../repositories/worker.repository";
import { FinanceFluxInteractor } from "../interactors/financeFlux.interactor";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";

const assertFlux = (flux: IFlujoFinanciero | null) => {
  if (!flux) throw new Error("Flux not found");
};

const getAllFinanceFluxes = async () => await FinanceFluxRepository.findAll();

const registerFinanceFlux = async (flux: IFlujoFinanciero) =>
  await FinanceFluxRepository.registerFinanceFlux(flux);


const payDebt = async (fluxId: string) => {
  const _id = new Types.ObjectId(fluxId);
  const flux = await FinanceFluxRepository.findById(_id);
  assertFlux(flux);
  if (!flux!.esDeuda) throw new Error("Este flujo no es una deuda");

  await FinanceFluxRepository.updateById(fluxId, { esDeuda: false });

  await SellerRepository.incrementDebt(flux!.vendedor!.toString(), -flux!.monto);
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

const updateFinanceFlux = async (fluxId: string, updates: Partial<IFlujoFinanciero>) => {
  const _id = new Types.ObjectId(fluxId);

  const existingFlux = await FinanceFluxRepository.findById(_id);
  if (!existingFlux) throw new Error("Flujo no encontrado");

  const oldDeuda = existingFlux.esDeuda ? existingFlux.monto : 0;

  const updatedFlux = await FinanceFluxRepository.updateById(fluxId, updates);
  if (!updatedFlux) throw new Error("Error al actualizar el flujo");


  const newDeuda = updatedFlux.esDeuda ? updatedFlux.monto : 0;
  const diff = newDeuda - oldDeuda;

  if (diff !== 0 && updatedFlux.id_vendedor) {
    await SellerRepository.incrementDebt(updatedFlux.id_vendedor.toString(), diff);
  }

  return updatedFlux;
};


export const FinanceFluxService = {
  getAllFinanceFluxes,
  registerFinanceFlux,
  payDebt,
  getWorkerById,
  getSellerById,
  getSellerInfoById,
  getStatsService,
  updateFinanceFlux
};
