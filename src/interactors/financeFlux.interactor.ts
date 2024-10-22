import { FLUX_TYPES } from "../constants/fluxTypes";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";

const { GASTO, INGRESO } = FLUX_TYPES;
const getTotalByFluxType = async (fluxType: string) => {
  try {
    const allFluxes = await FinanceFluxRepository.findAll();
    const filteredFluxes = allFluxes.filter(
      (flux) => !flux.esDeuda && flux.tipo === fluxType
    );
    const total = filteredFluxes.reduce(
      (acc, flux) => Number(flux.monto) + acc,
      0.0
    );
    return total;
  } catch (error) {
    throw new Error(`Error while calculating total value ${error}`);
  }
};

const getStatsInteractor = async () => {
  try {
    //TODO: finish delivery stats
    const expenses = await getTotalByFluxType(GASTO);
    const income = await getTotalByFluxType(INGRESO);
    const stats = {
      expenses: expenses,
      income: income,
      utility: income - expenses,
    };
    return stats;
  } catch (error) {
    throw new Error(`Error while calculating total utility value ${error}`);
  }
};

export const FinanceFluxInteractor = { getStatsInteractor };
