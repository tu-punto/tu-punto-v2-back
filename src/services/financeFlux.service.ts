import { SellerRepository } from "./../repositories/seller.repository";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { WorkerRepository } from "../repositories/worker.repository";
import { FinanceFluxInteractor } from "../interactors/financeFlux.interactor";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";

const getAllFinanceFluxes = async () => {
  const financeFluxes = await FinanceFluxRepository.findAll();
  return financeFluxes;
};

const registerFinanceFlux = async (financeFlux: IFlujoFinanciero) => {
  console.log("Llegué a registerservice",financeFlux);
  const newFinanceFlux = await FinanceFluxRepository.registerFinanceFlux(
    financeFlux
  );
  return newFinanceFlux;
};

const getWorkerById = async (workerId: any) => {
  const financeFlux = await FinanceFluxRepository.findWorkerById(workerId);
  if (!financeFlux)
    throw new Error("Doesn't exist such worker with that id fk from FinanceFlux");

  const worker = financeFlux.trabajador as ITrabajador; 

  if (!worker) {
    throw new Error("No worker found with the given id");
  }

  return {
    id_trabajador: worker.id_trabajador,
    nombre: worker.nombre,
  };
};



const getSellerById = async (sellerId: any) => {
  const financeFlux = await FinanceFluxRepository.findSellerById(sellerId);
  if (!financeFlux)
    throw new Error(
      "Doesn't exist such seller with that id fk from FinanceFlux"
    );

   const sellerData = financeFlux.vendedor as IVendedor;

  const seller = await SellerRepository.findById(sellerData.id_vendedor);
  if (!seller) {
    throw new Error("No seller found with the given id");
  }

  return {
    id_vendedor: seller.id_vendedor,
    nombre: seller.nombre,
    apellido: seller.apellido,
    marca: seller.marca,
  };
};

const getSellerInfoById = async (sellerId: any) => {
  const financeFlux = await FinanceFluxRepository.findSellerInfoById(sellerId);
  if (!financeFlux)
    throw new Error(
      "Doesn't exist such seller with that id fk from FinanceFlux"
    );
  return financeFlux;
};

const getStatsService = async () => {
  const stats = await FinanceFluxInteractor.getStatsInteractor();
  if (!stats)
    throw new Error(
      "Failed to get stats on FinanceFluxService.getStatsService"
    );
  return stats;
};

export const FinanceFluxService = {
  getAllFinanceFluxes,
  registerFinanceFlux,
  getWorkerById,
  getSellerById,
  getSellerInfoById,
  getStatsService,
};
