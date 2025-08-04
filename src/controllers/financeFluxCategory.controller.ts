import { Request, Response } from "express";
import { FinanceFluxCategoryService } from "../services/financeFluxCategory.service";

export const getFinanceFluxCategories = async (req: Request, res: Response) => {
  try {
    const categories =
      await FinanceFluxCategoryService.getAllFinanceFluxCategories();
    res.json({ status: true, categories });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ msg: "Error getting finance flux categories", error });
  }
};

export const createFinanceFluxCategory = async (
  req: Request,
  res: Response
) => {
  const financeFluxCategory = req.body;
  try {
    const newCategory =
      await FinanceFluxCategoryService.createFinanceFluxCategory(
        financeFluxCategory
      );
    res.json({ status: true, newCategory });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ msg: "Error creating finance flux category", error });
  }
};

export const deleteFinanceFluxCategoryById = async (
  req: Request,
  res: Response
) => {
  const financeFluxId = req.params.id;
  try {
    const deletedCategory =
      await FinanceFluxCategoryService.deleteFinanceFluxCategoryById(
        financeFluxId
      );
    if (!deletedCategory) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }
    res.json({ status: true, deletedCategory });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ msg: "Error deleting finance flux category by id", error });
  }
};
