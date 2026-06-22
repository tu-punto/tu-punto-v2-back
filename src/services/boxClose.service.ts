import { ICierreCaja } from "../entities/ICierreCaja";
import { BoxCloseRepository } from "../repositories/boxClose.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { Types } from "mongoose";

const getAllBoxClosings = async () => {
  return await BoxCloseRepository.findAll();
};

const normalizeOperationType = (tipo: unknown): "INGRESO" | "GASTO" => {
  const normalized = String(tipo || "").trim().toLowerCase();
  return normalized === "gasto" || normalized === "gasto_profit" ? "GASTO" : "INGRESO";
};

const getOperationCategory = (tipo: unknown) =>
  normalizeOperationType(tipo) === "GASTO" ? "Gasto (Cierre)" : "Ingreso (Cierre)";

const normalizeOperationDate = (value: unknown, fallback?: unknown) => {
  const date = value ? new Date(value as any) : fallback ? new Date(fallback as any) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const createCompanyFinanceFluxForOperations = async (boxClose: any) => {
  const plainBoxClose =
    typeof boxClose?.toObject === "function"
      ? boxClose.toObject()
      : boxClose;
  const operations = Array.isArray(plainBoxClose?.operaciones_adicionales)
    ? plainBoxClose.operaciones_adicionales
    : [];
  let changed = false;

  const nextOperations = [];
  for (const operation of operations) {
    const affectsCompany = operation?.afecta_empresa === true;
    if (!affectsCompany || operation?.finance_flux_id) {
      nextOperations.push(operation);
      continue;
    }

    const amount = Math.abs(Number(operation?.monto || 0));
    if (amount <= 0) {
      nextOperations.push(operation);
      continue;
    }

    const branchId = String(operation?.id_sucursal || plainBoxClose?.id_sucursal || "").trim();
    const sellerId = String(operation?.id_vendedor || "").trim();
    const financeFlux = await FinanceFluxRepository.registerFinanceFlux({
      tipo: normalizeOperationType(operation?.tipo),
      categoria: getOperationCategory(operation?.tipo),
      concepto: String(operation?.concepto || operation?.descripcion || "Operacion de caja").trim(),
      monto: amount,
      fecha: normalizeOperationDate(operation?.fecha, plainBoxClose?.closed_at || plainBoxClose?.created_at),
      esDeuda: false,
      id_sucursal: branchId && Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : undefined,
      id_vendedor: sellerId && Types.ObjectId.isValid(sellerId) ? new Types.ObjectId(sellerId) : undefined,
    } as any);

    changed = true;
    nextOperations.push({
      ...operation,
      finance_flux_id: financeFlux._id,
    });
  }

  if (!changed) return boxClose;
  return await BoxCloseRepository.updateBoxClose(String(plainBoxClose._id), {
    operaciones_adicionales: nextOperations,
  } as Partial<ICierreCaja>);
};

const registerBoxClose = async (boxClose: any) => {
  const created = await BoxCloseRepository.registerBoxClose(boxClose);
  return await createCompanyFinanceFluxForOperations(created);
};

const getBoxCloseById = async (id: string) => {
  const category = await BoxCloseRepository.getBoxCloseById(id);
  if (!category) throw new Error("Doesn't exist a box close with such id");
  return category;
};
const updateBoxClose = async (id: string, updates: Partial<ICierreCaja>) => {
  const updated = await BoxCloseRepository.updateBoxClose(id, updates);
  if (!updated) return updated;
  return await createCompanyFinanceFluxForOperations(updated);
};


export const BoxCloseService = {
  getAllBoxClosings,
  registerBoxClose,
  getBoxCloseById,
  updateBoxClose,
};
