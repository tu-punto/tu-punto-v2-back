import { FLUX_TYPES } from "../constants/fluxTypes";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { ShippingRepository } from "../repositories/shipping.repository";

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

const getDeliveryTotal = async () => {
  try {
    const allShippings = await ShippingRepository.findAll();
    let deliveryIncome = 0;
    let deliveryExpense = 0;

    for (const shipping of allShippings) {
      deliveryIncome += shipping.cargo_delivery;
      deliveryExpense += shipping.costo_delivery;
    }
    return { deliveryIncome, deliveryExpense };
  } catch (error) {
    throw new Error(`Error while calculating total value ${error}`);
  }
};

const getStatsInteractor = async () => {
  try {
    const expenses = await getTotalByFluxType(GASTO);
    const income = await getTotalByFluxType(INGRESO);
    const { deliveryIncome, deliveryExpense } = await getDeliveryTotal();
    const stats = {
      expenses: expenses,
      income: income,
      utility: income - expenses,
      deliveryIncome: deliveryIncome,
      deliveryExpense: deliveryExpense,
    };
    return stats;
  } catch (error) {
    throw new Error(`Error while calculating total utility value ${error}`);
  }
};

export const FinanceFluxInteractor = { getStatsInteractor };
