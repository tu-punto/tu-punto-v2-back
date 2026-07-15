import { ICierreCaja } from "../entities/ICierreCaja";
import { BoxCloseRepository } from "../repositories/boxClose.repository";
import { BoxClosePendingOperationRepository } from "../repositories/boxClosePendingOperation.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { Types } from "mongoose";
import dayjs from "dayjs";

const getAllBoxClosings = async () => {
  return await BoxCloseRepository.findAll();
};

const getBoxCloseSummary = async (filters?: {
  from?: string;
  to?: string;
  sucursalIds?: string[];
}) => {
  const boxClosings = await BoxCloseRepository.findAll(filters?.sucursalIds);
  const from = filters?.from ? dayjs(filters.from) : null;
  const to = filters?.to ? dayjs(filters.to) : null;

  return boxClosings.filter((boxClose: any) => {
    const date = dayjs(boxClose?.closed_at || boxClose?.created_at);
    if (!date.isValid()) return false;
    if (from?.isValid() && date.isBefore(from, "day")) return false;
    if (to?.isValid() && date.isAfter(to, "day")) return false;
    return true;
  });
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

const normalizeOperationAmount = (value: unknown) => Math.abs(Number(value || 0));

const buildBusinessDate = (value?: unknown) => {
  const base = dayjs((value as any) || new Date());
  return base.isValid() ? base.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
};

const buildDayRange = (businessDate: string) => {
  const base = dayjs(businessDate, "YYYY-MM-DD");
  return {
    start: base.startOf("day").toDate(),
    end: base.endOf("day").toDate(),
  };
};

const operationExists = (operations: any[], sourceKey: string) =>
  Array.isArray(operations) &&
  operations.some((operation) => String(operation?.source_key || "").trim() === sourceKey);

const appendOperationToBoxClose = async (boxClose: any, operation: any) => {
  const plainBoxClose =
    typeof boxClose?.toObject === "function"
      ? boxClose.toObject()
      : boxClose;
  const sourceKey = String(operation?.source_key || "").trim();
  const operations = Array.isArray(plainBoxClose?.operaciones_adicionales)
    ? plainBoxClose.operaciones_adicionales
    : [];

  if (sourceKey && operationExists(operations, sourceKey)) {
    return boxClose;
  }

  return await BoxCloseRepository.updateBoxClose(String(plainBoxClose._id), {
    operaciones_adicionales: [...operations, operation],
  } as Partial<ICierreCaja>);
};

const attachPendingOperationsToBoxClose = async (boxClose: any) => {
  const plainBoxClose =
    typeof boxClose?.toObject === "function"
      ? boxClose.toObject()
      : boxClose;
  const branchId = String(plainBoxClose?.id_sucursal || "").trim();
  if (!branchId) return boxClose;

  const businessDate = buildBusinessDate(plainBoxClose?.closed_at || plainBoxClose?.created_at);
  const pendingRows = await BoxClosePendingOperationRepository.findPendingByBranchAndBusinessDate(
    branchId,
    businessDate
  );
  if (!pendingRows.length) return boxClose;

  const existingOperations = Array.isArray(plainBoxClose?.operaciones_adicionales)
    ? plainBoxClose.operaciones_adicionales
    : [];
  const pendingOperations = pendingRows
    .map((row: any) => row.operation)
    .filter((operation: any) => {
      const sourceKey = String(operation?.source_key || "").trim();
      return !sourceKey || !operationExists(existingOperations, sourceKey);
    });

  if (!pendingOperations.length) {
    await BoxClosePendingOperationRepository.markApplied(
      pendingRows.map((row: any) => String(row._id)),
      String(plainBoxClose._id)
    );
    return boxClose;
  }

  const updated = await BoxCloseRepository.updateBoxClose(String(plainBoxClose._id), {
    operaciones_adicionales: [...existingOperations, ...pendingOperations],
  } as Partial<ICierreCaja>);
  await BoxClosePendingOperationRepository.markApplied(
    pendingRows.map((row: any) => String(row._id)),
    String(plainBoxClose._id)
  );
  return updated || boxClose;
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
  const withPendingOperations = await attachPendingOperationsToBoxClose(created);
  return await createCompanyFinanceFluxForOperations(withPendingOperations);
};

const getBoxCloseById = async (id: string) => {
  const category = await BoxCloseRepository.getBoxCloseById(id);
  if (!category) throw new Error("Doesn't exist a box close with such id");
  return category;
};
const updateBoxClose = async (id: string, updates: Partial<ICierreCaja>) => {
  const updated = await BoxCloseRepository.updateBoxClose(id, updates);
  if (!updated) return updated;
  const withPendingOperations = await attachPendingOperationsToBoxClose(updated);
  return await createCompanyFinanceFluxForOperations(withPendingOperations);
};

const getPendingOperationsForBranchAndDate = async (branchId: string, businessDate: string) => {
  const rows = await BoxClosePendingOperationRepository.findPendingByBranchAndBusinessDate(
    branchId,
    businessDate
  );

  return rows.map((row: any) => row.operation);
};

const registerBranchTransferBoxCloseOperation = async (params: {
  sourceKey: string;
  branchId: string;
  amount: number;
  method: "efectivo" | "qr";
  mode: "send" | "receive";
  occurredAt?: string;
  packageCount?: number;
}) => {
  const sourceKey = String(params.sourceKey || "").trim();
  const branchId = String(params.branchId || "").trim();
  const amount = normalizeOperationAmount(params.amount);
  const businessDate = buildBusinessDate(params.occurredAt);
  if (!sourceKey || !branchId || !Types.ObjectId.isValid(branchId) || amount <= 0) {
    return { success: false, stored: false };
  }

  const operation = {
    tipo: "delivery" as const,
    descripcion:
      params.mode === "receive"
        ? `Confirmacion de llegada entre sucursales (${params.packageCount || 0} paquetes)`
        : `Envio entre sucursales (${params.packageCount || 0} paquetes)`,
    concepto:
      params.mode === "receive"
        ? "Costo delivery por llegada entre sucursales"
        : "Costo delivery por envio entre sucursales",
    categoria: "Ingreso (Cierre)",
    metodo: params.method,
    monto: amount,
    afecta_empresa: true,
    fecha: normalizeOperationDate(params.occurredAt),
    id_sucursal: new Types.ObjectId(branchId),
    source_key: sourceKey,
    auto_generated: true,
  };

  const { start, end } = buildDayRange(businessDate);
  const currentBoxClose = await BoxCloseRepository.findLatestBySucursalOnDay(branchId, start, end);

  if (currentBoxClose) {
    const updated = await appendOperationToBoxClose(currentBoxClose, operation);
    if (updated) {
      await createCompanyFinanceFluxForOperations(updated);
      return { success: true, stored: true, target: "box_close" as const };
    }
  }

  const existingPending = await BoxClosePendingOperationRepository.findBySourceKey(sourceKey);
  if (existingPending) {
    return { success: true, stored: true, target: "pending" as const };
  }

  await BoxClosePendingOperationRepository.registerPendingOperation({
    source_key: sourceKey,
    business_date: businessDate,
    id_sucursal: new Types.ObjectId(branchId),
    operation,
  });
  return { success: true, stored: true, target: "pending" as const };
};


export const BoxCloseService = {
  getAllBoxClosings,
  getBoxCloseSummary,
  registerBoxClose,
  getBoxCloseById,
  updateBoxClose,
  registerBranchTransferBoxCloseOperation,
  getPendingOperationsForBranchAndDate,
};
