import { IFlujoFinancieroCategoria } from "../entities/IFlujoFinancieroCategoria";
import { FinanceFluxCategoryRepository } from "../repositories/financeFluxCategory.repository";

const getAllFinanceFluxCategories = async () => {
  return await FinanceFluxCategoryRepository.findAll();
};

const createFinanceFluxCategory = async (
  financeFluxCategory: IFlujoFinancieroCategoria
) => {
  return await FinanceFluxCategoryRepository.create(financeFluxCategory);
};

const deleteFinanceFluxCategoryById = async (id: string) => {
  const category = await FinanceFluxCategoryRepository.findById(id);
  if (!category) throw new Error("Finance Flux Category not found");
  return await FinanceFluxCategoryRepository.deleteById(id);
};

export const FinanceFluxCategoryService = {
  getAllFinanceFluxCategories,
  createFinanceFluxCategory,
  deleteFinanceFluxCategoryById,
};
