import { Router } from "express";
import {
  getFinanceFluxCategories,
  createFinanceFluxCategory,
  deleteFinanceFluxCategoryById,
} from "../controllers/financeFluxCategory.controller";

const financeFluxCategoryRouter = Router();

financeFluxCategoryRouter.get("/", getFinanceFluxCategories);
financeFluxCategoryRouter.post("/", createFinanceFluxCategory);
financeFluxCategoryRouter.delete("/:id", deleteFinanceFluxCategoryById);

export default financeFluxCategoryRouter;
