import { Router } from "express";
import * as recurringExpenseController from "../controllers/recurringExpense.controller";

const recurringExpenseRouter = Router();

recurringExpenseRouter.get("/", recurringExpenseController.getRecurringExpenses);
recurringExpenseRouter.post("/", recurringExpenseController.createRecurringExpense);
recurringExpenseRouter.put("/:id", recurringExpenseController.updateRecurringExpense);
recurringExpenseRouter.delete("/:id", recurringExpenseController.deleteRecurringExpense);
recurringExpenseRouter.post("/:id/pay", recurringExpenseController.payRecurringExpense);

export default recurringExpenseRouter;
