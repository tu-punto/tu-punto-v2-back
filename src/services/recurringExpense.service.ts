import { format } from "date-fns";
import { Types } from "mongoose";

import { IRecurringExpense } from "../entities/IRecurringExpense";
import { FinanceFluxCategoryRepository } from "../repositories/financeFluxCategory.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { RecurringExpenseRepository } from "../repositories/recurringExpense.repository";

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeBranchId = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw || raw.toLowerCase() === "global") return null;
  return raw;
};

const normalizePayload = (payload: Partial<IRecurringExpense>) => {
  const tipo = normalizeText(payload?.tipo);
  const detalle = normalizeText(payload?.detalle);
  const monto = Number(payload?.monto ?? 0);
  const branchId = normalizeBranchId(payload?.id_sucursal as unknown);
  const paidUntil = payload?.hasta_cuando_se_pago
    ? new Date(payload.hasta_cuando_se_pago)
    : null;

  if (!tipo) {
    throw new Error("El tipo es obligatorio");
  }
  if (!Number.isFinite(monto) || monto < 0) {
    throw new Error("El monto es invalido");
  }
  if (!paidUntil || Number.isNaN(paidUntil.getTime())) {
    throw new Error("La fecha de hasta cuando se pago es obligatoria");
  }
  if (branchId && !Types.ObjectId.isValid(branchId)) {
    throw new Error("La sucursal seleccionada es invalida");
  }

  return {
    tipo,
    detalle,
    monto,
    id_sucursal: branchId ? new Types.ObjectId(branchId) : null,
    hasta_cuando_se_pago: paidUntil,
    activo: payload?.activo ?? true,
  };
};

const getServiceCategoryName = async () => {
  const categories = await FinanceFluxCategoryRepository.findAll();
  const serviceCategory = categories.find(
    (item: any) => normalizeText(item?.nombre).toLowerCase() === "servicio"
  );

  if (!serviceCategory) {
    throw new Error("No existe la categoria SERVICIO en Flujo_Financiero_Categoria");
  }

  return serviceCategory.nombre;
};

const getAllRecurringExpenses = async () => {
  return await RecurringExpenseRepository.findAll();
};

const createRecurringExpense = async (payload: Partial<IRecurringExpense>) => {
  const normalizedPayload = normalizePayload(payload);
  return await RecurringExpenseRepository.create(normalizedPayload);
};

const updateRecurringExpense = async (id: string, payload: Partial<IRecurringExpense>) => {
  const existing = await RecurringExpenseRepository.findById(id);
  if (!existing) {
    throw new Error("Gasto recurrente no encontrado");
  }

  const normalizedPayload = normalizePayload({
    tipo: payload?.tipo ?? existing.tipo,
    detalle: payload?.detalle ?? existing.detalle,
    monto: payload?.monto ?? existing.monto,
    id_sucursal: payload?.id_sucursal ?? (existing.id_sucursal as any)?._id ?? existing.id_sucursal ?? null,
    hasta_cuando_se_pago:
      payload?.hasta_cuando_se_pago ?? existing.hasta_cuando_se_pago,
    activo: existing.activo,
  });

  const updated = await RecurringExpenseRepository.updateById(id, normalizedPayload);
  if (!updated) {
    throw new Error("No se pudo actualizar el gasto recurrente");
  }

  return updated;
};

const deleteRecurringExpense = async (id: string) => {
  const deleted = await RecurringExpenseRepository.deleteById(id);
  if (!deleted) {
    throw new Error("Gasto recurrente no encontrado");
  }
};

const payRecurringExpense = async (id: string) => {
  const existing = await RecurringExpenseRepository.findById(id);
  if (!existing) {
    throw new Error("Gasto recurrente no encontrado");
  }

  const detail = normalizeText(existing.detalle) || normalizeText(existing.tipo);
  const categoryName = await getServiceCategoryName();
  const paidUntil = new Date(existing.hasta_cuando_se_pago);
  const formattedDate = format(paidUntil, "dd/MM/yyyy");

  const updated = await RecurringExpenseRepository.updateById(id, {
    detalle: detail,
    hasta_cuando_se_pago: paidUntil,
  });

  const createdFlux = await FinanceFluxRepository.registerFinanceFlux({
    tipo: "GASTO",
    categoria: categoryName,
    concepto: `${existing.tipo} hasta ${formattedDate}`,
    monto: Number(existing.monto || 0),
    fecha: paidUntil,
    esDeuda: false,
    id_sucursal: existing.id_sucursal
      ? new Types.ObjectId(String((existing.id_sucursal as any)?._id || existing.id_sucursal))
      : undefined,
  });

  return {
    recurringExpense: updated,
    financeFlux: createdFlux,
  };
};

export const RecurringExpenseService = {
  getAllRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  payRecurringExpense,
};
