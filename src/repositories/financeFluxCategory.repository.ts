import { IFlujoFinancieroCategoria } from "../entities/IFlujoFinancieroCategoria";
import { FlujoFinancieroCategoriaModel } from "../entities/implements/FlujoFinancieroCategoriaSchema";

const findAll = () => {
  return FlujoFinancieroCategoriaModel.find({ activo: true });
};

const findById = (id: string) => {
  return FlujoFinancieroCategoriaModel.findById(id).where({ activo: true });
};

const create = (category: IFlujoFinancieroCategoria) => {
  return FlujoFinancieroCategoriaModel.create(category);
};

const deleteById = (id: string) => {
  return FlujoFinancieroCategoriaModel.findByIdAndUpdate(
    id,
    { activo: false },
    { new: true }
  );
};

export const FinanceFluxCategoryRepository = {
  findAll,
  findById,
  create,
  deleteById,
};
