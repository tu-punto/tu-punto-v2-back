import moment from "moment-timezone";
import { Types } from "mongoose";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaModel } from "../entities/implements/VentaSchema";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import { FinanceStatsMonthlyModel } from "../entities/implements/FinanceStatsMonthlySchema";
import { FinanceStatsMonthStateModel } from "../entities/implements/FinanceStatsMonthStateSchema";
import { READY_FOR_PICKUP_STATUS, IN_TRANSIT_STATUS } from "../utils/branchTransferStatus";

const TZ = "America/La_Paz";
const UNASSIGNED_BRANCH_ID = "__unassigned__";
const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;
const REBUILD_COOLDOWN_MS = 2 * 60 * 1000;

type AggregatedBranchMonth = {
  monthKey: string;
  branchId: string;
  branchName: string;
  monthlyPaymentsIncome: number;
  expenses: number;
  investments: number;
  commissionIncome: number;
  deliveryIncomeReal: number;
  deliveryIncomePotential: number;
  deliveryExpenses: number;
  externalDeliveryIncome: number;
  externalDeliveredPackageTotalReal: number;
  externalDeliveredPackageTotalPotential: number;
  simplePackagesNoDeliveryTotalReal: number;
  simplePackagesNoDeliveryTotalPotential: number;
  simplePackagesInterbranchTotalReal: number;
  simplePackagesInterbranchTotalPotential: number;
  expenseCategories: Record<string, number>;
  builtAt: Date;
};

type SummaryQuery = {
  months?: string[];
  fromDate?: Date;
  toDate?: Date;
  sucursalIds?: string[];
  expenseCategories?: string[];
  includeCommissions?: boolean;
  includeDeliveries?: boolean;
  deliveryMode?: "real" | "potential";
};

let reconcileTimer: NodeJS.Timeout | null = null;
let reconcileInFlight = false;

const roundCurrency = (value: number) => +Number(value || 0).toFixed(2);
const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizeId = (value: any) => String(value?._id || value || "").trim();
const normalizeMonthKey = (value: string) => moment.tz(`${value}-01`, TZ).format("YYYY-MM");
const normalizeStringList = (values?: string[]) =>
  Array.from(new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean)));

const monthBounds = (monthKey: string) => {
  const start = moment.tz(`${normalizeMonthKey(monthKey)}-01 00:00:00`, "YYYY-MM-DD HH:mm:ss", TZ);
  return {
    from: start.toDate(),
    to: start.clone().endOf("month").toDate(),
  };
};

const monthKeyFromDate = (value: unknown) => {
  const date = value ? moment.tz(value as any, TZ) : null;
  return date?.isValid() ? date.format("YYYY-MM") : "";
};

const monthRangeBetween = (from?: Date, to?: Date) => {
  if (!from && !to) return [];
  const start = moment.tz(from || to || new Date(), TZ).startOf("month");
  const end = moment.tz(to || from || new Date(), TZ).startOf("month");
  const months: string[] = [];
  const cursor = start.clone();
  while (cursor.isSameOrBefore(end, "month")) {
    months.push(cursor.format("YYYY-MM"));
    cursor.add(1, "month");
  }
  return months;
};

const getRequestedMonths = async (query: SummaryQuery) => {
  const explicitMonths = normalizeStringList(query.months);
  if (explicitMonths.length) return explicitMonths;

  const rangedMonths = monthRangeBetween(query.fromDate, query.toDate);
  if (rangedMonths.length) return rangedMonths;

  const aggregateMonths = await FinanceStatsMonthlyModel.distinct("monthKey");
  if (aggregateMonths.length) {
    return aggregateMonths.sort();
  }

  const [fluxMonths, shippingMonths, saleMonths, externalMonths] = await Promise.all([
    FlujoFinancieroModel.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha", timezone: TZ } } } },
    ]),
    PedidoModel.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha_pedido", timezone: TZ } } } },
    ]),
    PedidoModel.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha_pedido", timezone: TZ } } } },
    ]),
    VentaExternaModel.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha_pedido", timezone: TZ } } } },
    ]),
  ]);

  return Array.from(
    new Set(
      [...fluxMonths, ...shippingMonths, ...saleMonths, ...externalMonths]
        .map((row: any) => String(row?._id || "").trim())
        .filter(Boolean)
    )
  ).sort();
};

const createEmptyAggregate = (monthKey: string, branchId: string, branchName: string): AggregatedBranchMonth => ({
  monthKey,
  branchId,
  branchName,
  monthlyPaymentsIncome: 0,
  expenses: 0,
  investments: 0,
  commissionIncome: 0,
  deliveryIncomeReal: 0,
  deliveryIncomePotential: 0,
  deliveryExpenses: 0,
  externalDeliveryIncome: 0,
  externalDeliveredPackageTotalReal: 0,
  externalDeliveredPackageTotalPotential: 0,
  simplePackagesNoDeliveryTotalReal: 0,
  simplePackagesNoDeliveryTotalPotential: 0,
  simplePackagesInterbranchTotalReal: 0,
  simplePackagesInterbranchTotalPotential: 0,
  expenseCategories: {},
  builtAt: new Date(),
});

const getDeliveryAmountReal = (shipping: any) =>
  roundCurrency(
    Number(shipping?.cargo_delivery || 0) +
      Number(shipping?.monto_paga_comprador || 0) +
      Number(shipping?.monto_paga_vendedor || 0)
  );

const getDeliveryAmountPotential = (shipping: any) => {
  const packagePrice = Number(shipping?.precio_paquete || 0);
  const branchRoutePrice = Number(shipping?.precio_entre_sucursal ?? shipping?.cargo_delivery ?? 0);
  return roundCurrency(Number(shipping?.precio_total || packagePrice + branchRoutePrice));
};

const isDeliveredStatus = (value: unknown) => normalizeText(value) === "entregado";
const isCompletedExternalSale = (sale: any) => Boolean(sale?.delivered) || isDeliveredStatus(sale?.estado_pedido);
const isCompletedSimplePackageShipping = (shipping: any) =>
  Boolean(shipping?.simple_package_order) && isDeliveredStatus(shipping?.estado_pedido);

const getShippingBranchIds = (shipping: any) => ({
  originId: normalizeId(shipping?.lugar_origen),
  destinationId: normalizeId(shipping?.destino_sucursal || shipping?.sucursal),
});

const shouldCountDeliveryExpenseForBranch = (shipping: any, branchId: string) => {
  if (!branchId || branchId === UNASSIGNED_BRANCH_ID) return true;
  const { originId, destinationId } = getShippingBranchIds(shipping);
  if (!originId || !destinationId || originId === destinationId) {
    return normalizeId(shipping?.sucursal || shipping?.lugar_origen) === branchId;
  }

  const status = normalizeText(shipping?.estado_pedido);
  if (originId === branchId && status === IN_TRANSIT_STATUS.toLowerCase()) return true;
  if (destinationId === branchId && status === READY_FOR_PICKUP_STATUS.toLowerCase()) return true;
  return false;
};

const getAllBranchEntries = async () => {
  const branches = await SucursalModel.find({}, { _id: 1, nombre: 1 }).lean();
  const mapped = branches.map((branch: any) => ({
    branchId: String(branch?._id || "").trim(),
    branchName: String(branch?.nombre || "").trim(),
  })).filter((branch) => branch.branchId);
  mapped.push({ branchId: UNASSIGNED_BRANCH_ID, branchName: "Sin sucursal" });
  return mapped;
};

const rebuildMonth = async (monthKey: string) => {
  const safeMonthKey = normalizeMonthKey(monthKey);
  const state = await FinanceStatsMonthStateModel.findOneAndUpdate(
    { monthKey: safeMonthKey },
    {
      $set: {
        rebuilding: true,
        dirty: true,
        rebuildRequestedAt: new Date(),
        lastError: "",
      },
    },
    { upsert: true, new: true }
  );

  try {
    const { from, to } = monthBounds(safeMonthKey);
    const branchEntries = await getAllBranchEntries();
    const branchMap = new Map<string, AggregatedBranchMonth>();
    branchEntries.forEach((entry) => {
      branchMap.set(entry.branchId, createEmptyAggregate(safeMonthKey, entry.branchId, entry.branchName));
    });

    const [fluxes, shippings, externalSales, sellers] = await Promise.all([
      FlujoFinancieroModel.find({ fecha: { $gte: from, $lte: to }, visible_en_flujo_general: { $ne: false } }).lean(),
      PedidoModel.find({ fecha_pedido: { $gte: from, $lte: to } }).lean(),
      VentaExternaModel.find({ fecha_pedido: { $gte: from, $lte: to }, anulado: { $ne: true } }).lean(),
      VendedorModel.find({}, { _id: 1, comision_porcentual: 1, comision_fija: 1 }).lean(),
    ]);
    const shippingIds = shippings.map((shipping: any) => shipping?._id).filter(Boolean);
    const sales = shippingIds.length
      ? await VentaModel.find({ pedido: { $in: shippingIds } }).lean()
      : [];

    const sellerMap = new Map<string, { percent: number; fixed: number }>();
    sellers.forEach((seller: any) => {
      sellerMap.set(String(seller?._id || ""), {
        percent: Number(seller?.comision_porcentual || 0),
        fixed: Number(seller?.comision_fija || 0),
      });
    });

    const salesByPedido = new Map<string, any[]>();
    sales.forEach((sale: any) => {
      const pedidoId = normalizeId(sale?.pedido);
      if (!pedidoId) return;
      const current = salesByPedido.get(pedidoId) || [];
      current.push(sale);
      salesByPedido.set(pedidoId, current);
    });

    for (const flux of fluxes) {
      const details = Array.isArray((flux as any)?.detalle_servicios) ? (flux as any).detalle_servicios : [];
      if (details.length) {
        for (const detail of details) {
          const branchId = normalizeId(detail?.id_sucursal) || UNASSIGNED_BRANCH_ID;
          const target = branchMap.get(branchId);
          if (!target) continue;
          const total = roundCurrency(Number(detail?.total || 0));
          if ((flux as any).tipo === "INGRESO") target.monthlyPaymentsIncome += total;
          else if ((flux as any).tipo === "GASTO") {
            target.expenses += total;
            const key = String((flux as any).categoria || "").trim();
            target.expenseCategories[key] = roundCurrency((target.expenseCategories[key] || 0) + total);
          } else if ((flux as any).tipo === "INVERSION") {
            target.investments += total;
          }
        }
        continue;
      }

      const branchId = normalizeId((flux as any)?.id_sucursal) || UNASSIGNED_BRANCH_ID;
      const target = branchMap.get(branchId);
      if (!target) continue;
      const amount = roundCurrency(Number((flux as any)?.monto || 0));
      if ((flux as any).tipo === "INGRESO") target.monthlyPaymentsIncome += amount;
      else if ((flux as any).tipo === "GASTO") {
        target.expenses += amount;
        const key = String((flux as any).categoria || "").trim();
        target.expenseCategories[key] = roundCurrency((target.expenseCategories[key] || 0) + amount);
      } else if ((flux as any).tipo === "INVERSION") {
        target.investments += amount;
      }
    }

    for (const shipping of shippings) {
      const originId = normalizeId((shipping as any)?.lugar_origen) || normalizeId((shipping as any)?.sucursal);
      const destinationId = normalizeId((shipping as any)?.destino_sucursal || (shipping as any)?.sucursal) || originId;
      const accountingBranchId =
        originId && destinationId && originId !== destinationId
          ? normalizeText((shipping as any)?.estado_pedido) === IN_TRANSIT_STATUS.toLowerCase()
            ? originId
            : destinationId
          : destinationId || originId || UNASSIGNED_BRANCH_ID;
      const target = branchMap.get(accountingBranchId) || branchMap.get(UNASSIGNED_BRANCH_ID);
      if (!target) continue;

      const realDeliveryAmount = roundCurrency(Number((shipping as any)?.cargo_delivery || 0));
      const realDeliveryExpense = roundCurrency(Number((shipping as any)?.costo_delivery || 0));
      const potentialDeliveryAmount = getDeliveryAmountPotential(shipping);
      const branchShippingPrice = roundCurrency(Number((shipping as any)?.precio_entre_sucursal ?? (shipping as any)?.cargo_delivery ?? 0));
      const packagePrice = roundCurrency(Number((shipping as any)?.precio_paquete || 0));

      target.deliveryIncomeReal = roundCurrency(target.deliveryIncomeReal + realDeliveryAmount);
      target.deliveryIncomePotential = roundCurrency(target.deliveryIncomePotential + potentialDeliveryAmount);
      if (shouldCountDeliveryExpenseForBranch(shipping, target.branchId)) {
        target.deliveryExpenses = roundCurrency(target.deliveryExpenses + realDeliveryExpense);
      }

      if (branchShippingPrice > 0) {
        target.simplePackagesInterbranchTotalReal = roundCurrency(
          target.simplePackagesInterbranchTotalReal + realDeliveryAmount
        );
        target.simplePackagesInterbranchTotalPotential = roundCurrency(
          target.simplePackagesInterbranchTotalPotential + potentialDeliveryAmount
        );
      } else {
        const realPackageValue = isCompletedSimplePackageShipping(shipping) ? packagePrice : 0;
        target.simplePackagesNoDeliveryTotalReal = roundCurrency(
          target.simplePackagesNoDeliveryTotalReal + realPackageValue
        );
        target.simplePackagesNoDeliveryTotalPotential = roundCurrency(
          target.simplePackagesNoDeliveryTotalPotential + packagePrice
        );
      }

      const pedidoId = normalizeId((shipping as any)?._id);
      const linkedSales = salesByPedido.get(pedidoId) || [];
      for (const sale of linkedSales) {
        const seller = sellerMap.get(normalizeId((sale as any)?.vendedor));
        const totalSale = roundCurrency(Number((sale as any)?.precio_unitario || 0) * Number((sale as any)?.cantidad || 0));
        const commission = roundCurrency(
          (totalSale * Number(seller?.percent || 0)) / 100 + Number(seller?.fixed || 0)
        );
        target.commissionIncome = roundCurrency(target.commissionIncome + commission);
      }
    }

    for (const sale of externalSales) {
      const originId = normalizeId((sale as any)?.origen_sucursal) || normalizeId((sale as any)?.sucursal);
      const destinationId = normalizeId((sale as any)?.destino_sucursal) || normalizeId((sale as any)?.sucursal);
      const accountingBranchId = destinationId || originId || UNASSIGNED_BRANCH_ID;
      const target = branchMap.get(accountingBranchId) || branchMap.get(UNASSIGNED_BRANCH_ID);
      if (!target) continue;

      const subtotalQr = roundCurrency(Number((sale as any)?.subtotal_qr || 0));
      const subtotalEfectivo = roundCurrency(Number((sale as any)?.subtotal_efectivo || 0));
      const buyerIncome =
        subtotalQr > 0 || subtotalEfectivo > 0
          ? roundCurrency(subtotalQr + subtotalEfectivo)
          : roundCurrency(
              Number((sale as any)?.deuda_comprador ?? (sale as any)?.monto_paga_comprador ?? (sale as any)?.saldo_cobrar ?? 0)
            );
      const sellerIncome = roundCurrency(Number((sale as any)?.monto_paga_vendedor || 0));
      target.externalDeliveryIncome = roundCurrency(target.externalDeliveryIncome + buyerIncome + sellerIncome);

      const packagePotential = roundCurrency(Number((sale as any)?.precio_total || (sale as any)?.precio_paquete || 0));
      const packageReal = isCompletedExternalSale(sale)
        ? roundCurrency(Number((sale as any)?.precio_paquete || 0))
        : 0;

      target.externalDeliveredPackageTotalReal = roundCurrency(
        target.externalDeliveredPackageTotalReal + packageReal
      );
      target.externalDeliveredPackageTotalPotential = roundCurrency(
        target.externalDeliveredPackageTotalPotential + packagePotential
      );
    }

    const docs = Array.from(branchMap.values()).map((row) => ({
      ...row,
      monthlyPaymentsIncome: roundCurrency(row.monthlyPaymentsIncome),
      expenses: roundCurrency(row.expenses),
      investments: roundCurrency(row.investments),
      commissionIncome: roundCurrency(row.commissionIncome),
      deliveryIncomeReal: roundCurrency(row.deliveryIncomeReal),
      deliveryIncomePotential: roundCurrency(row.deliveryIncomePotential),
      deliveryExpenses: roundCurrency(row.deliveryExpenses),
      externalDeliveryIncome: roundCurrency(row.externalDeliveryIncome),
      externalDeliveredPackageTotalReal: roundCurrency(row.externalDeliveredPackageTotalReal),
      externalDeliveredPackageTotalPotential: roundCurrency(row.externalDeliveredPackageTotalPotential),
      simplePackagesNoDeliveryTotalReal: roundCurrency(row.simplePackagesNoDeliveryTotalReal),
      simplePackagesNoDeliveryTotalPotential: roundCurrency(row.simplePackagesNoDeliveryTotalPotential),
      simplePackagesInterbranchTotalReal: roundCurrency(row.simplePackagesInterbranchTotalReal),
      simplePackagesInterbranchTotalPotential: roundCurrency(row.simplePackagesInterbranchTotalPotential),
      builtAt: new Date(),
    }));

    await FinanceStatsMonthlyModel.deleteMany({ monthKey: safeMonthKey });
    if (docs.length) {
      await FinanceStatsMonthlyModel.insertMany(docs, { ordered: false });
    }
    await FinanceStatsMonthStateModel.updateOne(
      { monthKey: safeMonthKey },
      {
        $set: {
          dirty: false,
          rebuilding: false,
          rebuiltAt: new Date(),
          lastError: "",
        },
      }
    );
  } catch (error: any) {
    await FinanceStatsMonthStateModel.updateOne(
      { monthKey: safeMonthKey },
      {
        $set: {
          dirty: true,
          rebuilding: false,
          lastError: error?.message || "No se pudo reconstruir el agregado mensual",
        },
      }
    );
    throw error;
  }
};

const requestMonthRebuild = async (monthKey: string, options?: { sync?: boolean }) => {
  const safeMonthKey = normalizeMonthKey(monthKey);
  const state = await FinanceStatsMonthStateModel.findOneAndUpdate(
    { monthKey: safeMonthKey },
    {
      $set: {
        dirty: true,
        rebuildRequestedAt: new Date(),
      },
      $setOnInsert: {
        rebuilding: false,
        rebuiltAt: null,
      },
    },
    { upsert: true, new: true }
  ).lean();

  if (options?.sync) {
    await rebuildMonth(safeMonthKey);
    return;
  }

  const recentlyBuilt =
    state?.rebuiltAt && Date.now() - new Date(state.rebuiltAt).getTime() < REBUILD_COOLDOWN_MS;
  if (state?.rebuilding || recentlyBuilt) return;

  setTimeout(() => {
    void rebuildMonth(safeMonthKey).catch((error) => {
      console.error("[finance-stats-aggregate] rebuild:error", {
        monthKey: safeMonthKey,
        error: error?.message || String(error),
      });
    });
  }, 0);
};

const ensureMonthsReady = async (months: string[]) => {
  const normalizedMonths = normalizeStringList(months);
  if (!normalizedMonths.length) return [];

  const states = await FinanceStatsMonthStateModel.find({ monthKey: { $in: normalizedMonths } }).lean();
  const stateMap = new Map(states.map((state: any) => [String(state.monthKey), state]));

  for (const month of normalizedMonths) {
    const state = stateMap.get(month);
    const hasDocs = await FinanceStatsMonthlyModel.exists({ monthKey: month });
    const isCurrentMonth = month === moment.tz(TZ).format("YYYY-MM");
    const isStaleCurrentMonth =
      isCurrentMonth &&
      state?.rebuiltAt &&
      Date.now() - new Date(state.rebuiltAt).getTime() > REBUILD_COOLDOWN_MS;
    if (!hasDocs || state?.dirty || isStaleCurrentMonth) {
      await requestMonthRebuild(month, { sync: true });
    }
  }

  return normalizedMonths;
};

const sumSummaryDocs = (docs: any[], query: SummaryQuery) => {
  const selectedCategories = normalizeStringList(query.expenseCategories).map((item) => item.toLowerCase());
  const includeCommissions = query.includeCommissions !== false;
  const includeDeliveries = query.includeDeliveries !== false;
  const deliveryMode = query.deliveryMode === "potential" ? "potential" : "real";

  let monthlyPaymentsIncome = 0;
  let investments = 0;
  let commissionIncome = 0;
  let deliveryIncome = 0;
  let deliveryExpenses = 0;
  let externalDeliveryIncome = 0;
  let externalDeliveredPackageTotal = 0;
  let simplePackagesNoDeliveryTotal = 0;
  let simplePackagesInterbranchTotal = 0;
  let expenses = 0;

  for (const doc of docs) {
    monthlyPaymentsIncome += Number(doc?.monthlyPaymentsIncome || 0);
    investments += Number(doc?.investments || 0);
    if (includeCommissions) {
      commissionIncome += Number(doc?.commissionIncome || 0);
    }
    if (includeDeliveries) {
      deliveryIncome += Number(
        deliveryMode === "potential" ? doc?.deliveryIncomePotential : doc?.deliveryIncomeReal
      );
      deliveryExpenses += Number(doc?.deliveryExpenses || 0);
      externalDeliveryIncome += Number(doc?.externalDeliveryIncome || 0);
      externalDeliveredPackageTotal += Number(
        deliveryMode === "potential"
          ? doc?.externalDeliveredPackageTotalPotential
          : doc?.externalDeliveredPackageTotalReal
      );
      simplePackagesNoDeliveryTotal += Number(
        deliveryMode === "potential"
          ? doc?.simplePackagesNoDeliveryTotalPotential
          : doc?.simplePackagesNoDeliveryTotalReal
      );
      simplePackagesInterbranchTotal += Number(
        deliveryMode === "potential"
          ? doc?.simplePackagesInterbranchTotalPotential
          : doc?.simplePackagesInterbranchTotalReal
      );
    }

    const categories = doc?.expenseCategories || {};
    if (selectedCategories.length) {
      for (const [key, amount] of Object.entries(categories)) {
        if (selectedCategories.includes(String(key).trim().toLowerCase())) {
          expenses += Number(amount || 0);
        }
      }
    } else {
      expenses += Number(doc?.expenses || 0);
    }
  }

  const deliveryPackagesIncome = externalDeliveredPackageTotal + simplePackagesNoDeliveryTotal + simplePackagesInterbranchTotal;
  const ingresos = monthlyPaymentsIncome + commissionIncome + externalDeliveryIncome;
  const balanceDelivery = deliveryIncome - deliveryExpenses;
  const utilidad = ingresos - expenses + balanceDelivery;
  const caja = investments + utilidad;

  return {
    ingresos: roundCurrency(ingresos),
    gastos: roundCurrency(expenses),
    investments: roundCurrency(investments),
    inversiones: roundCurrency(investments),
    comision: roundCurrency(commissionIncome),
    commissionIncome: roundCurrency(commissionIncome),
    deliveryIncome: roundCurrency(deliveryIncome),
    deliveryExpenses: roundCurrency(deliveryExpenses),
    externalDeliveryIncome: roundCurrency(externalDeliveryIncome),
    externalDeliveredPackageTotal: roundCurrency(externalDeliveredPackageTotal),
    simplePackagesNoDeliveryTotal: roundCurrency(simplePackagesNoDeliveryTotal),
    simplePackagesInterbranchTotal: roundCurrency(simplePackagesInterbranchTotal),
    balanceDelivery: roundCurrency(balanceDelivery),
    utilidad: roundCurrency(utilidad),
    utility: roundCurrency(utilidad),
    caja: roundCurrency(caja),
    monthlyPaymentsIncome: roundCurrency(monthlyPaymentsIncome),
    deliveryPackagesIncome: roundCurrency(deliveryPackagesIncome),
    historicalIncome: roundCurrency(ingresos),
    historicalExpenses: roundCurrency(expenses),
    expenses: roundCurrency(expenses),
  };
};

const getSummary = async (query: SummaryQuery) => {
  const months = await ensureMonthsReady(await getRequestedMonths(query));
  const selectedBranchIds = normalizeStringList(query.sucursalIds);
  const docs = await FinanceStatsMonthlyModel.find({
    monthKey: { $in: months },
    ...(selectedBranchIds.length
      ? { branchId: { $in: selectedBranchIds } }
      : { branchId: { $ne: UNASSIGNED_BRANCH_ID } }),
  }).lean();
  return sumSummaryDocs(docs, query);
};

const getBranchRows = async (query: SummaryQuery) => {
  const months = await ensureMonthsReady(await getRequestedMonths(query));
  const selectedBranchIds = normalizeStringList(query.sucursalIds);
  const docs = await FinanceStatsMonthlyModel.find({
    monthKey: { $in: months },
    branchId: { $nin: [UNASSIGNED_BRANCH_ID] },
    ...(selectedBranchIds.length ? { branchId: { $in: selectedBranchIds } } : {}),
  }).lean();

  const grouped = new Map<string, any[]>();
  for (const doc of docs) {
    const branchId = String(doc?.branchId || "");
    const current = grouped.get(branchId) || [];
    current.push(doc);
    grouped.set(branchId, current);
  }

  return Array.from(grouped.entries())
    .map(([branchId, rows]) => {
      const summary = sumSummaryDocs(rows, query);
      return {
        id: branchId,
        label: String(rows[0]?.branchName || branchId),
        utility: Number(summary.utility || 0),
        income: Number(summary.monthlyPaymentsIncome || 0) + Number(summary.commissionIncome || 0) + Number(summary.deliveryPackagesIncome || 0),
        expenses: Number(summary.expenses || 0),
      };
    })
    .sort((a, b) => Math.abs(b.utility) - Math.abs(a.utility));
};

const markDateDirty = async (value: unknown) => {
  const monthKey = monthKeyFromDate(value);
  if (!monthKey) return;
  await requestMonthRebuild(monthKey);
};

const reconcileDirtyMonths = async () => {
  if (reconcileInFlight) return;
  reconcileInFlight = true;
  try {
    const dirtyMonths = await FinanceStatsMonthStateModel.find({
      dirty: true,
      rebuilding: { $ne: true },
    })
      .sort({ rebuildRequestedAt: 1, updatedAt: 1 })
      .limit(3)
      .lean();

    for (const month of dirtyMonths) {
      await rebuildMonth(String(month.monthKey));
    }
  } catch (error) {
    console.error("[finance-stats-aggregate] reconcile:error", error);
  } finally {
    reconcileInFlight = false;
  }
};

const startReconcileScheduler = () => {
  if (reconcileTimer) return;
  reconcileTimer = setInterval(() => {
    void reconcileDirtyMonths();
  }, RECONCILE_INTERVAL_MS);
};

export const FinanceStatsAggregateService = {
  getSummary,
  getBranchRows,
  markDateDirty,
  requestMonthRebuild,
  startReconcileScheduler,
};
