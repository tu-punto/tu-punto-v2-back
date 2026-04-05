import { Request, Response } from "express";

import { RecurringExpenseService } from "../services/recurringExpense.service";

export const getRecurringExpenses = async (_req: Request, res: Response) => {
  try {
    const rows = await RecurringExpenseService.getAllRecurringExpenses();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Error obteniendo gastos recurrentes", error });
  }
};

export const createRecurringExpense = async (req: Request, res: Response) => {
  try {
    const created = await RecurringExpenseService.createRecurringExpense(req.body || {});
    return res.json({ ok: true, created });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || "Error creando gasto recurrente" });
  }
};

export const updateRecurringExpense = async (req: Request, res: Response) => {
  try {
    const updated = await RecurringExpenseService.updateRecurringExpense(req.params.id, req.body || {});
    return res.json({ ok: true, updated });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || "Error actualizando gasto recurrente" });
  }
};

export const deleteRecurringExpense = async (req: Request, res: Response) => {
  try {
    await RecurringExpenseService.deleteRecurringExpense(req.params.id);
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || "Error eliminando gasto recurrente" });
  }
};

export const payRecurringExpense = async (req: Request, res: Response) => {
  try {
    const result = await RecurringExpenseService.payRecurringExpense(req.params.id);
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    return res.status(400).json({ ok: false, message: error?.message || "Error pagando gasto recurrente" });
  }
};
