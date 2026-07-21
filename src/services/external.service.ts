import moment from "moment-timezone";
import { Types } from "mongoose";
import { ExternalPaidStatus, IVentaExterna, PackagePaymentMethod, PackageSize } from "../entities/IVentaExterna";
import { ExternalSaleRepository } from "../repositories/external.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { SellerRepository } from "../repositories/seller.repository";
import { OrderGuideService } from "./orderGuide.service";
import { SimplePackageBranchPriceRepository } from "../repositories/simplePackageBranchPrice.repository";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import { OrderGuideWhatsappService } from "./orderGuideWhatsapp.service";
import { PackageEscalationConfigService } from "./packageEscalationConfig.service";
import { calculateLatePickupFee, resolveBranchPickupFeeStart } from "../utils/latePickupFee";
import { TrackingFreezeService } from "./trackingFreeze.service";
import { assertEditableIfNotDeliveredOlderThanFiveDays } from "./deliveryEditGuard";
import { READY_FOR_PICKUP_STATUS, resolveBranchTransferInitialStatus } from "../utils/branchTransferStatus";

const getAllExternalSales = async () => {
  return await ExternalSaleRepository.getAllExternalSales();
};

const getExternalSalesList = async (params: {
  page?: number;
  limit?: number;
  status?: string;
  from?: Date;
  to?: Date;
  sucursalId?: string;
  client?: string;
}) => {
  return await ExternalSaleRepository.getExternalSalesList(params);
};

const getExternalContactSuggestions = async (params: {
  query?: string;
  field?: "seller_carnet" | "name" | "phone";
  limit?: number;
}) => {
  return await ExternalSaleRepository.getExternalContactSuggestions(params);
};

const getExternalSaleByID = async (id: string) => {
  return await ExternalSaleRepository.getExternalSaleByID(id);
};

const toTrimmed = (value: unknown): string => String(value ?? "").trim();

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value: number): number => +Number(value || 0).toFixed(2);

const toObjectIdOrUndefined = (value?: string) =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;

const getOptionalNonNegativeAmount = (value: unknown): number | null => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = roundCurrency(toNumber(value, NaN));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const isSameBusinessDay = (value: unknown) => {
  const date = moment.tz(value as any, "America/La_Paz");
  if (!date.isValid()) return false;
  return date.isSame(moment().tz("America/La_Paz"), "day");
};

const getBusinessDayRange = (value: unknown) => {
  const start = moment.tz(value as any, "America/La_Paz").startOf("day");
  return {
    from: start.toDate(),
    to: start.clone().add(1, "day").toDate(),
  };
};

const isBranchTransferSale = (row: any) => {
  const originId = toTrimmed((row?.origen_sucursal as any)?._id ?? row?.origen_sucursal ?? row?.sucursal);
  const destinationId = toTrimmed((row?.destino_sucursal as any)?._id ?? row?.destino_sucursal ?? row?.sucursal);
  return Boolean(originId && destinationId && originId !== destinationId);
};

const resolveStorageFeeStartForExternal = (row: any) =>
  isBranchTransferSale(row)
    ? row?.public_tracking_frozen === true
      ? null
      : resolveBranchPickupFeeStart(row)
    : row?.fecha_pedido;

const resolveLatePickupFeeForExternalDelivery = (row: any, pickedUpAt: unknown) => {
  if (row?.public_tracking_frozen === true) {
    return roundCurrency(Number(row?.late_pickup_fee || 0));
  }

  return calculateLatePickupFee({
    startAt: resolveStorageFeeStartForExternal(row),
    pickedUpAt: pickedUpAt || new Date(),
  });
};

const EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE: Record<string, string> = {
  "1": "Transferencia o QR",
  "2": "Efectivo",
  "4": "Efectivo + QR",
};

const normalizeExternalDate = (value: unknown) => {
  if (value) {
    return moment.tz(value as string, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  return moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
};

const normalizePaidStatus = (value: unknown): ExternalPaidStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (value === true || normalized === "si" || normalized === "sí" || normalized === "pagado" || normalized === "paid") {
    return "si";
  }
  if (normalized === "mixto" || normalized === "mixed" || normalized === "adelanto" || normalized === "parcial") {
    return "mixto";
  }
  return "no";
};

const normalizeSellerPaymentMethod = (value: unknown): PackagePaymentMethod => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "efectivo" || normalized === "qr") return normalized;
  return "";
};

const normalizePackageSize = (value: unknown) =>
  String(value || "").trim().toLowerCase() === "grande" ? "grande" : "estandar";

const normalizeDeliveryPaymentType = (value: unknown): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE[trimmed]) {
    return EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE[trimmed];
  }

  const normalized = trimmed.toLowerCase();
  const existing = Object.values(EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE).find(
    (label) => label.toLowerCase() === normalized
  );

  return existing || "";
};

const normalizeOrderStatus = (value: unknown, delivered: boolean): string => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return delivered ? "Entregado" : "En Espera";
};

const resolveExternalBranchRoutePricing = async (originBranchId?: string, destinationBranchId?: string) => {
  if (!originBranchId && !destinationBranchId) {
    return {
      precioEntreSucursal: 0,
      originBranchId: "",
      destinationBranchId: "",
      destinationBranchName: "",
      routeId: "",
    };
  }

  const safeOriginBranchId = toTrimmed(originBranchId || destinationBranchId);
  const safeDestinationBranchId = toTrimmed(destinationBranchId || originBranchId);
  if (!Types.ObjectId.isValid(safeOriginBranchId) || !Types.ObjectId.isValid(safeDestinationBranchId)) {
    throw new Error("Debe seleccionar sucursales validas");
  }

  if (safeOriginBranchId === safeDestinationBranchId) {
    const route = await SimplePackageBranchPriceRepository.findPriceByRoute(
      safeOriginBranchId,
      safeDestinationBranchId
    );
    const branch = await SucursalModel.findById(safeOriginBranchId).select("nombre").lean();
    return {
      precioEntreSucursal: 0,
      originBranchId: safeOriginBranchId,
      destinationBranchId: safeDestinationBranchId,
      destinationBranchName: String((branch as any)?.nombre || "").trim(),
      routeId: String((route as any)?._id || ""),
    };
  }

  const route = await SimplePackageBranchPriceRepository.findPriceByRoute(
    safeOriginBranchId,
    safeDestinationBranchId
  );
  if (!route) {
    throw new Error("No existe un precio configurado entre las sucursales seleccionadas");
  }

  return {
    precioEntreSucursal: roundCurrency(Number((route as any)?.precio || 0)),
    originBranchId: safeOriginBranchId,
    destinationBranchId: safeDestinationBranchId,
    destinationBranchName: String((route as any)?.destino_sucursal?.nombre || "").trim(),
    routeId: String((route as any)?._id || ""),
  };
};

const registerExternalMixedIncome = async (params: {
  paymentMethod: "efectivo" | "qr";
  amount: number;
  packageCount: number;
  branchId?: string;
}) => {
  const amount = roundCurrency(params.amount);
  if (amount <= 0) return;

  await FinanceFluxRepository.registerFinanceFlux({
    tipo: "INGRESO",
    categoria: "SERVICIO",
    concepto:
      params.packageCount > 1
        ? `Entregas externas pagadas por vendedor en ${params.paymentMethod} (${params.packageCount})`
        : `Entrega externa pagada por vendedor en ${params.paymentMethod}`,
    monto: amount,
    fecha: new Date(),
    esDeuda: false,
    visible_en_flujo_general: false,
    id_sucursal:
      params.branchId && Types.ObjectId.isValid(params.branchId)
        ? new Types.ObjectId(params.branchId)
        : undefined,
  });
};

const adjustExternalSellerIncome = async (params: {
  paymentMethod: "efectivo" | "qr";
  amountDelta: number;
  branchId?: string;
  date?: unknown;
}) => {
  const amountDelta = roundCurrency(params.amountDelta);
  if (!params.paymentMethod || amountDelta === 0) return;

  const range = getBusinessDayRange(params.date || new Date());
  const existingFlux = await FinanceFluxRepository.findExternalSellerIncomeForAdjustment({
    paymentMethod: params.paymentMethod,
    branchId: params.branchId,
    from: range.from,
    to: range.to,
  });

  if (existingFlux) {
    await FinanceFluxRepository.updateById(String((existingFlux as any)._id), {
      monto: roundCurrency(Math.max(0, Number((existingFlux as any).monto || 0) + amountDelta)),
    });
    return;
  }

  if (amountDelta > 0) {
    await registerExternalMixedIncome({
      paymentMethod: params.paymentMethod,
      amount: amountDelta,
      packageCount: 1,
      branchId: params.branchId,
    });
  }
};

const resolveExternalDeliveryPayment = (params: {
  delivered: boolean;
  buyerAmount: number;
  paymentType?: unknown;
  subtotalQr?: unknown;
  subtotalEfectivo?: unknown;
}) => {
  const buyerAmount = roundCurrency(params.buyerAmount);
  if (!params.delivered || buyerAmount <= 0) {
    return {
      tipoDePago: "",
      subtotalQr: 0,
      subtotalEfectivo: 0,
    };
  }

  const tipoDePago = normalizeDeliveryPaymentType(params.paymentType);
  const subtotalQr = roundCurrency(toNumber(params.subtotalQr, 0));
  const subtotalEfectivo = roundCurrency(toNumber(params.subtotalEfectivo, 0));

  if (!tipoDePago) {
    return {
      tipoDePago: EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE["2"],
      subtotalQr: 0,
      subtotalEfectivo: buyerAmount,
    };
  }

  if (tipoDePago === EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE["1"]) {
    return {
      tipoDePago,
      subtotalQr: buyerAmount,
      subtotalEfectivo: 0,
    };
  }

  if (tipoDePago === EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE["2"]) {
    return {
      tipoDePago,
      subtotalQr: 0,
      subtotalEfectivo: buyerAmount,
    };
  }

  if (tipoDePago !== EXTERNAL_DELIVERY_PAYMENT_LABEL_BY_CODE["4"]) {
    throw new Error("Tipo de pago de entrega no valido");
  }

  if (subtotalQr <= 0 || subtotalEfectivo <= 0) {
    throw new Error("En pago mixto de entrega ambos montos deben ser mayores a 0");
  }

  if (Math.abs(roundCurrency(subtotalQr + subtotalEfectivo) - buyerAmount) > 0.01) {
    throw new Error("La suma de QR + efectivo debe ser igual a la deuda del comprador");
  }

  return {
    tipoDePago,
    subtotalQr,
    subtotalEfectivo,
  };
};

const getSimplePackageFinancials = (input: any) => {
  const packagePrice = roundCurrency(toNumber(input?.precio_paquete ?? input?.precio_total, 0));
  const shippingPrice = roundCurrency(toNumber(input?.precio_entre_sucursal ?? input?.cargo_delivery, 0));
  const packageSaldo = roundCurrency(toNumber(input?.saldo_por_paquete, 0));
  const amortizacion = roundCurrency(toNumber(input?.amortizacion_vendedor, 0));
  const totalServicePrice = roundCurrency(packagePrice + shippingPrice);
  const totalToCharge = roundCurrency(Math.max(0, packagePrice + packageSaldo + shippingPrice - amortizacion));
  const sellerPending = roundCurrency(packagePrice + packageSaldo - amortizacion);

  return {
    packagePrice,
    shippingPrice,
    packageSaldo,
    amortizacion,
    totalServicePrice,
    totalToCharge,
    sellerPending,
  };
};

const adjustSellerSaldoPendiente = async (sellerId: string, delta: number) => {
  const safeDelta = roundCurrency(delta);
  if (!sellerId || !Number.isFinite(safeDelta) || safeDelta === 0) return;

  const seller = await SellerRepository.findById(sellerId);
  if (!seller) return;

  await SellerRepository.updateSeller(sellerId, {
    saldo_pendiente: roundCurrency(Number(seller?.saldo_pendiente || 0) + safeDelta),
  });
};

const applyExternalMixedIncomeFromRecords = async (records: IVentaExterna[]) => {
  const totals = records.reduce(
    (acc, row) => {
      const method = normalizeSellerPaymentMethod(row.metodo_pago);
      const amount = roundCurrency(Number(row.monto_paga_vendedor || row.amortizacion_vendedor || 0));
      if (!method || amount <= 0) return acc;

      acc[method].amount = roundCurrency(acc[method].amount + amount);
      acc[method].count += 1;
      acc.branchId = acc.branchId || String(row.sucursal || "");
      return acc;
    },
    {
      efectivo: { amount: 0, count: 0 },
      qr: { amount: 0, count: 0 },
      branchId: "",
    }
  );

  if (totals.efectivo.amount > 0) {
    await registerExternalMixedIncome({
      paymentMethod: "efectivo",
      amount: totals.efectivo.amount,
      packageCount: totals.efectivo.count,
      branchId: totals.branchId || undefined,
    });
  }

  if (totals.qr.amount > 0) {
    await registerExternalMixedIncome({
      paymentMethod: "qr",
      amount: totals.qr.amount,
      packageCount: totals.qr.count,
      branchId: totals.branchId || undefined,
    });
  }
};

const validateBuyerIdentity = (input: any) => {
  const buyerPhone = toTrimmed(input.telefono_comprador);
  if (!buyerPhone) {
    throw new Error("Debe ingresar el celular del comprador");
  }
};

const resolvePaymentSplit = (
  paidStatus: ExternalPaidStatus,
  amountToCharge: number,
  montoVendedorRaw: unknown,
  montoCompradorRaw: unknown
) => {
  let montoPagaVendedor = toNumber(montoVendedorRaw, 0);
  let montoPagaComprador = toNumber(montoCompradorRaw, 0);

  if (montoPagaVendedor < 0 || montoPagaComprador < 0) {
    throw new Error("Los montos de pago no pueden ser negativos");
  }

  if (paidStatus === "si") {
    return {
      montoPagaVendedor: +amountToCharge.toFixed(2),
      montoPagaComprador: 0,
      saldoCobrar: 0,
    };
  }

  if (paidStatus === "no") {
    return {
      montoPagaVendedor: 0,
      montoPagaComprador: 0,
      saldoCobrar: +amountToCharge.toFixed(2),
    };
  }

  const mixedTotal = +(montoPagaVendedor + montoPagaComprador).toFixed(2);
  if (amountToCharge <= 0) {
    throw new Error("Para pago mixto el precio del paquete debe ser mayor a 0");
  }
  if (montoPagaVendedor <= 0 || montoPagaComprador <= 0) {
    throw new Error("En pago mixto ambos deben pagar un monto mayor a 0");
  }
  if (montoPagaVendedor >= amountToCharge || montoPagaComprador >= amountToCharge) {
    throw new Error("En pago mixto ninguna parte puede pagar todo el monto");
  }
  if (Math.abs(mixedTotal - amountToCharge) > 0.01) {
    throw new Error("En pago mixto la suma debe ser exactamente igual al monto total a cobrar");
  }

  return {
    montoPagaVendedor: +montoPagaVendedor.toFixed(2),
    montoPagaComprador: +montoPagaComprador.toFixed(2),
    saldoCobrar: +montoPagaComprador.toFixed(2),
  };
};

const buildExternalRecord = async (input: any, index = 0): Promise<IVentaExterna> => {
  validateBuyerIdentity(input);

  const paid = normalizePaidStatus(input.esta_pagado);
  const originBranchId = toTrimmed(input.origen_sucursal_id ?? input.origen_sucursal ?? input.sucursal ?? input.id_sucursal);
  const destinationBranchId = toTrimmed(input.destino_sucursal_id ?? input.destino_sucursal ?? originBranchId);
  const branchRoute = await resolveExternalBranchRoutePricing(originBranchId, destinationBranchId);
  const batchPackageCount = Math.max(1, toNumber(input.batch_package_count ?? input.numero_paquetes, 1));
  const requestedDeliverySpaces = Math.max(1, toNumber(input.delivery_spaces ?? 1, 1));
  const effectiveDeliverySpaces = requestedDeliverySpaces;
  const packageSize = await PackageEscalationConfigService.resolvePackageSizeBySpaces({
    routeId: branchRoute.routeId,
    deliverySpaces: effectiveDeliverySpaces,
    fallbackSize: normalizePackageSize(input.package_size ?? input.tamano),
  }) as PackageSize;
  const deliveryPricing =
    branchRoute.originBranchId === branchRoute.destinationBranchId
      ? { total: 0, spaces: effectiveDeliverySpaces }
      : await PackageEscalationConfigService.getDeliveryPricing({
          routeId: branchRoute.routeId,
          packageCount: batchPackageCount,
          packageSize,
          deliverySpaces: effectiveDeliverySpaces,
          escalationSpaces: Math.max(1, toNumber(input.batch_delivery_spaces ?? effectiveDeliverySpaces, effectiveDeliverySpaces)),
          fallbackRoutePrice: branchRoute.precioEntreSucursal,
        });
  const branchRoutePrice = deliveryPricing.total;
  const configuredPackagePrice = await PackageEscalationConfigService.getExternalUnitPrice({
    routeId: branchRoute.routeId,
    packageCount: batchPackageCount,
    packageSize,
  });
  const packagePrice = getOptionalNonNegativeAmount(input.precio_paquete) ?? configuredPackagePrice;
  const totalServicePrice = roundCurrency(packagePrice + branchRoutePrice);
  const buyerName = toTrimmed(input.comprador ?? input.nombre_comprador);
  const buyerPhone = toTrimmed(input.telefono_comprador);
  const defaultStatus = resolveBranchTransferInitialStatus(branchRoute.originBranchId, branchRoute.destinationBranchId);
  const requestedStatus = String(input.estado_pedido ?? "").trim();
  const estadoPedido =
    requestedStatus && requestedStatus !== "En Espera"
      ? requestedStatus
      : input.delivered === true
        ? "Entregado"
        : defaultStatus;
  const delivered = estadoPedido === "Entregado";
  const { montoPagaVendedor, montoPagaComprador, saldoCobrar } = resolvePaymentSplit(
    paid,
    totalServicePrice,
    input.monto_paga_vendedor,
    input.monto_paga_comprador
  );
  const totalSaldoCobrar = roundCurrency(saldoCobrar);
  const totalBuyerDebt =
    paid === "mixto"
      ? roundCurrency(montoPagaComprador)
      : toNumber(input.deuda_comprador ?? totalSaldoCobrar ?? input.monto_paga_comprador ?? totalServicePrice, totalServicePrice);
  const sellerPaymentMethod =
    montoPagaVendedor > 0
      ? normalizeSellerPaymentMethod(input.metodo_pago ?? input.paymentMethod ?? input.seller_payment_method)
      : "";
  const trackingFreezeFields = await TrackingFreezeService.getFreezeFieldsForOrder({
    originBranchId: branchRoute.originBranchId,
    destinationBranchId: branchRoute.destinationBranchId,
  });

  return {
    id_vendedor: input.id_vendedor,
    carnet_vendedor: toTrimmed(input.carnet_vendedor ?? input.carnet ?? "SN"),
    vendedor: toTrimmed(input.vendedor ?? input.nombre_vendedor ?? "Externo"),
    telefono_vendedor: toTrimmed(input.telefono_vendedor) || undefined,
    numero_paquete: toNumber(input.numero_paquete, index + 1),
    comprador: buyerName || undefined,
    descripcion_paquete: toTrimmed(input.descripcion_paquete ?? input.descripcion ?? "Sin descripcion"),
    telefono_comprador: buyerPhone || undefined,
    fecha_pedido: normalizeExternalDate(input.fecha_pedido) as unknown as Date,
    public_tracking_received_at: new Date(),
    ...trackingFreezeFields,
    sucursal: toObjectIdOrUndefined(branchRoute.originBranchId),
    origen_sucursal: toObjectIdOrUndefined(branchRoute.originBranchId),
    destino_sucursal: toObjectIdOrUndefined(branchRoute.destinationBranchId),
    service_origin: "external",
    package_size: packageSize,
    delivery_spaces: effectiveDeliverySpaces,
    precio_paquete_unitario: packagePrice,
    amortizacion_vendedor: toNumber(input.amortizacion_vendedor ?? input.monto_paga_vendedor, 0),
    deuda_comprador: totalBuyerDebt,
    metodo_pago: sellerPaymentMethod,
    tipo_de_pago: "",
    subtotal_qr: 0,
    subtotal_efectivo: 0,
    precio_paquete: packagePrice,
    precio_entre_sucursal: branchRoutePrice,
    cargo_delivery: branchRoutePrice,
    precio_total: totalServicePrice,
    esta_pagado: paid,
    monto_paga_vendedor: montoPagaVendedor,
    monto_paga_comprador: montoPagaComprador,
    saldo_cobrar: totalSaldoCobrar,
    estado_pedido: estadoPedido,
    delivered,
    is_external: true,
    hora_entrega_real: delivered
      ? (normalizeExternalDate(input.hora_entrega_real ?? input.fecha_pedido) as unknown as Date)
      : undefined,
    lugar_entrega: branchRoute.destinationBranchName || toTrimmed(input.lugar_entrega ?? "Externo"),
    direccion_delivery: input.direccion_delivery,
    ciudad_envio: input.ciudad_envio,
    nombre_flota: input.nombre_flota,
    precio_servicio: toNumber(input.precio_servicio, 0),
  };
};

const registerExternalSale = async (externalSale: any) => {
  if (Array.isArray(externalSale?.paquetes) && externalSale.paquetes.length > 0) {
    const created = await registerExternalSalesByPackages(externalSale);
    return created[0];
  }

  if (externalSale.id_sucursal) {
    externalSale.sucursal = externalSale.id_sucursal;
  }

  const record = await buildExternalRecord(externalSale);
  if (roundCurrency(Number(record.monto_paga_vendedor || 0)) > 0 && !record.metodo_pago) {
    throw new Error("Debe seleccionar si el pago del vendedor sera efectivo o QR");
  }
  await assignExternalGuideAndQR(record);
  const created = await ExternalSaleRepository.registerExternalSale(record);
  await applyExternalMixedIncomeFromRecords([record]);
  const populatedCreated = await ExternalSaleRepository.getExternalSaleByID(String(created._id));
  void OrderGuideWhatsappService.sendExternalRowsBestEffort([populatedCreated || created])
    .then(() => undefined)
    .catch((error) => {
      console.error("[external-service] whatsapp-dispatch:error", {
        externalSaleId: String(created._id),
        error: error?.message || String(error),
      });
    });
  return created;
};

const assignExternalGuideAndQR = async (record: IVentaExterna) => {
  await OrderGuideService.assignOrderGuide(record);
};

const registerExternalSalesByPackages = async (payload: any) => {
  const paquetes = Array.isArray(payload?.paquetes) ? payload.paquetes : [];
  if (!paquetes.length) throw new Error("Debe enviar al menos un paquete");
  const originBranchId = toTrimmed(payload?.origen_sucursal_id ?? payload?.originBranchId ?? payload?.sucursal ?? payload?.id_sucursal);
  const totalDeliverySpaces = paquetes.reduce((sum: number, pkg: any) => {
    const destinationBranchId = toTrimmed(pkg?.destino_sucursal_id ?? pkg?.destino_sucursal ?? originBranchId);
    if (!destinationBranchId || String(originBranchId || "") === String(destinationBranchId)) return sum;
    const spaces = Math.max(1, toNumber(pkg?.delivery_spaces ?? 1, 1));
    return roundCurrency(sum + spaces);
  }, 0);

  const toCreate: IVentaExterna[] = await Promise.all(paquetes.map(async (pkg: any, index: number) => {
    const merged = {
      ...payload,
      ...pkg,
      numero_paquete: pkg?.numero_paquete ?? index + 1,
      package_position_in_batch: index + 1,
      fecha_pedido: payload?.fecha_pedido,
      carnet_vendedor: payload?.carnet_vendedor,
      vendedor: payload?.vendedor,
      telefono_vendedor: payload?.telefono_vendedor,
      origen_sucursal_id: originBranchId,
      batch_delivery_spaces: totalDeliverySpaces || Math.max(1, toNumber(pkg?.delivery_spaces ?? 1, 1)),
      batch_package_count: paquetes.length,
      precio_total: undefined,
    };

    if (merged.id_sucursal) {
      merged.sucursal = merged.id_sucursal;
    }

    const record = await buildExternalRecord(merged, index);
    if (roundCurrency(Number(record.monto_paga_vendedor || 0)) > 0 && !record.metodo_pago) {
      throw new Error("Debe seleccionar si el pago del vendedor sera efectivo o QR");
    }

    return record;
  }));

  for (const record of toCreate) {
    await assignExternalGuideAndQR(record);
  }

  const created = await ExternalSaleRepository.registerExternalSales(toCreate);
  await applyExternalMixedIncomeFromRecords(toCreate);
  void OrderGuideWhatsappService.sendExternalRowsBestEffort(created)
    .then(() => undefined)
    .catch((error) => {
      console.error("[external-service] whatsapp-dispatch:error", {
        externalSaleIds: created.map((row) => String(row?._id || "")).filter(Boolean),
        error: error?.message || String(error),
      });
    });
  return created;
};

const deleteExternalSaleByID = async (id: string) => {
  const existing = await ExternalSaleRepository.getExternalSaleByID(id);
  if (!existing) return null;
  assertEditableIfNotDeliveredOlderThanFiveDays(existing as any);
  return await ExternalSaleRepository.deleteExternalSaleByID(id);
};

const updateExternalSaleByID = async (id: string, externalSale: any) => {
  const existing = await ExternalSaleRepository.getExternalSaleByID(id);
  if (!existing) return null;
  assertEditableIfNotDeliveredOlderThanFiveDays(existing as any);
  const existingDelivered = existing.estado_pedido === "Entregado" || existing.delivered === true;

  const serviceOrigin = (String(existing.service_origin || "external").trim() || "external") as
    | "external"
    | "simple_package";
  const paymentEditRequested =
    Object.prototype.hasOwnProperty.call(externalSale, "esta_pagado") ||
    Object.prototype.hasOwnProperty.call(externalSale, "monto_paga_vendedor") ||
    Object.prototype.hasOwnProperty.call(externalSale, "monto_paga_comprador") ||
    Object.prototype.hasOwnProperty.call(externalSale, "metodo_pago");
  const buyerNameEditRequested = Object.prototype.hasOwnProperty.call(externalSale, "comprador");
  const destinationEditRequested =
    Object.prototype.hasOwnProperty.call(externalSale, "destino_sucursal_id") ||
    Object.prototype.hasOwnProperty.call(externalSale, "destino_sucursal");

  if (serviceOrigin === "simple_package" && buyerNameEditRequested) {
    throw new Error("Por ahora no se puede editar el comprador de pedidos simples");
  }

  if ((paymentEditRequested || buyerNameEditRequested) && !isSameBusinessDay(existing.fecha_pedido)) {
    throw new Error("Solo se puede editar el cobro o el comprador el mismo dia que se creo la entrega");
  }
  if (destinationEditRequested && !isSameBusinessDay(existing.fecha_pedido)) {
    throw new Error("Solo se puede cambiar la sucursal destino el mismo dia que se creo la entrega");
  }

  const buyerName = toTrimmed(externalSale.comprador ?? existing.comprador);
  const buyerPhone = toTrimmed(externalSale.telefono_comprador ?? existing.telefono_comprador);

  const existingOriginBranchId = toTrimmed((existing.origen_sucursal as any)?._id ?? existing.origen_sucursal ?? existing.sucursal);
  const existingDestinationBranchId = toTrimmed((existing.destino_sucursal as any)?._id ?? existing.destino_sucursal ?? existing.sucursal);
  const nextOriginBranchId = toTrimmed(
    externalSale.origen_sucursal_id ?? externalSale.origen_sucursal ?? externalSale.sucursal ?? existingOriginBranchId
  );
  const nextDestinationBranchId = toTrimmed(
    externalSale.destino_sucursal_id ?? externalSale.destino_sucursal ?? existingDestinationBranchId ?? nextOriginBranchId
  );
  const shouldRecalculateRoutePricing =
    serviceOrigin === "external" &&
    (
      Object.prototype.hasOwnProperty.call(externalSale, "origen_sucursal_id") ||
      Object.prototype.hasOwnProperty.call(externalSale, "origen_sucursal") ||
      Object.prototype.hasOwnProperty.call(externalSale, "destino_sucursal_id") ||
      Object.prototype.hasOwnProperty.call(externalSale, "destino_sucursal") ||
      Object.prototype.hasOwnProperty.call(externalSale, "delivery_spaces") ||
      Object.prototype.hasOwnProperty.call(externalSale, "package_size") ||
      Object.prototype.hasOwnProperty.call(externalSale, "tamano") ||
      Object.prototype.hasOwnProperty.call(externalSale, "precio_paquete")
    );
  let nextPackageSize = normalizePackageSize(externalSale.package_size ?? externalSale.tamano ?? existing.package_size);
  let deliverySpaces = Math.max(1, toNumber(externalSale.delivery_spaces ?? existing.delivery_spaces ?? 1, 1));
  let price = toNumber(existing.precio_paquete ?? existing.precio_total, 0);
  let branchRoutePrice = roundCurrency(toNumber(existing.precio_entre_sucursal ?? existing.cargo_delivery, 0));
  let nextBranchRoute = null as Awaited<ReturnType<typeof resolveExternalBranchRoutePricing>> | null;

  if (shouldRecalculateRoutePricing) {
    nextBranchRoute = await resolveExternalBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId);
    deliverySpaces = Math.max(1, toNumber(externalSale.delivery_spaces ?? existing.delivery_spaces ?? 1, 1));
    const packagePriceCount = Math.max(
      1,
      toNumber(externalSale.batch_package_count ?? externalSale.numero_paquetes ?? existing.numero_paquete, 1)
    );
    nextPackageSize = await PackageEscalationConfigService.resolvePackageSizeBySpaces({
      routeId: nextBranchRoute.routeId,
      deliverySpaces,
      fallbackSize: nextPackageSize,
    }) as PackageSize;
    const deliveryPricing =
      nextBranchRoute.originBranchId === nextBranchRoute.destinationBranchId
        ? { total: 0, spaces: deliverySpaces }
        : await PackageEscalationConfigService.getDeliveryPricing({
            routeId: nextBranchRoute.routeId,
            packageCount: Math.max(1, toNumber(externalSale.batch_package_count ?? externalSale.numero_paquetes ?? existing.numero_paquete, 1)),
            packageSize: nextPackageSize,
            deliverySpaces,
            escalationSpaces: Math.max(1, toNumber(externalSale.batch_delivery_spaces ?? deliverySpaces, deliverySpaces)),
            fallbackRoutePrice: nextBranchRoute.precioEntreSucursal,
          });

    branchRoutePrice = deliveryPricing.total;
    const configuredPrice = await PackageEscalationConfigService.getExternalUnitPrice({
      routeId: nextBranchRoute.routeId,
      packageCount: packagePriceCount,
      packageSize: nextPackageSize,
    });
    price = getOptionalNonNegativeAmount(externalSale.precio_paquete) ?? configuredPrice;
  }

  const simplePackageFinancials = getSimplePackageFinancials({
    ...existing,
    ...externalSale,
    precio_paquete: price,
    precio_entre_sucursal: branchRoutePrice,
  });
  const amountToCharge =
    serviceOrigin === "simple_package" ? simplePackageFinancials.totalToCharge : roundCurrency(price + branchRoutePrice);
  const totalPrice =
    serviceOrigin === "simple_package" ? simplePackageFinancials.totalServicePrice : amountToCharge;
  const paid = normalizePaidStatus(externalSale.esta_pagado ?? existing.esta_pagado);
  const status = normalizeOrderStatus(
    externalSale.estado_pedido ?? existing.estado_pedido,
    externalSale.delivered === true || existing.delivered === true
  );
  const delivered = status === "Entregado";
  const hasPaymentAllocationUpdate =
    paymentEditRequested ||
    Object.prototype.hasOwnProperty.call(externalSale, "monto_paga_vendedor") ||
    Object.prototype.hasOwnProperty.call(externalSale, "monto_paga_comprador") ||
    shouldRecalculateRoutePricing;

  const { montoPagaVendedor, montoPagaComprador, saldoCobrar } = hasPaymentAllocationUpdate
    ? resolvePaymentSplit(
        paid,
        amountToCharge,
        externalSale.monto_paga_vendedor ?? existing.monto_paga_vendedor,
        externalSale.monto_paga_comprador ?? existing.monto_paga_comprador
      )
    : {
        montoPagaVendedor: roundCurrency(Number(existing.monto_paga_vendedor || 0)),
        montoPagaComprador: roundCurrency(Number(existing.monto_paga_comprador || 0)),
        saldoCobrar: roundCurrency(Number(existing.saldo_cobrar || 0)),
      };
  const hasPaymentStatusUpdate = Object.prototype.hasOwnProperty.call(externalSale, "esta_pagado");
  const hasSellerMethodUpdate = Object.prototype.hasOwnProperty.call(externalSale, "metodo_pago");
  const shouldRecalculateExternalBuyerDebt = hasPaymentStatusUpdate || hasPaymentAllocationUpdate;
  const buyerDebtAmount =
    serviceOrigin === "simple_package"
      ? toNumber(existing.deuda_comprador ?? externalSale.deuda_comprador, 0)
      : shouldRecalculateExternalBuyerDebt
        ? roundCurrency(saldoCobrar)
      : toNumber(
          externalSale.deuda_comprador ??
            existing.deuda_comprador ??
            roundCurrency(saldoCobrar) ??
            amountToCharge,
          amountToCharge
        );
  const deliveredAt =
    delivered && !externalSale.hora_entrega_real
      ? existingDelivered && existing.hora_entrega_real
        ? existing.hora_entrega_real
        : normalizeExternalDate(new Date())
      : externalSale.hora_entrega_real;
  const latePickupFeeToApply =
    (serviceOrigin === "external" || serviceOrigin === "simple_package") && delivered && !existingDelivered
      ? resolveLatePickupFeeForExternalDelivery(existing, deliveredAt || new Date())
      : 0;
  const persistedLatePickupFee = delivered || !existingDelivered
    ? roundCurrency(latePickupFeeToApply || Number(existing.late_pickup_fee || 0))
    : 0;
  const finalBuyerDebtAmount = roundCurrency(buyerDebtAmount + latePickupFeeToApply);
  const finalMontoPagaComprador = roundCurrency(montoPagaComprador + latePickupFeeToApply);
  const finalSaldoCobrar = roundCurrency(saldoCobrar + latePickupFeeToApply);
  const existingSellerPaymentMethod = normalizeSellerPaymentMethod(existing.metodo_pago);
  const isLegacyMixedWithoutSellerMethod =
    existing.esta_pagado === "mixto" &&
    !existingSellerPaymentMethod &&
    !hasPaymentStatusUpdate &&
    !hasSellerMethodUpdate &&
    !hasPaymentAllocationUpdate;
  const sellerPaymentMethod = montoPagaVendedor > 0
    ? normalizeSellerPaymentMethod(externalSale.metodo_pago ?? existing.metodo_pago) || (paymentEditRequested ? "efectivo" : "")
    : "";
  if (montoPagaVendedor > 0 && !sellerPaymentMethod && !isLegacyMixedWithoutSellerMethod) {
    throw new Error("Debe seleccionar si el pago del vendedor sera efectivo o QR");
  }
  const deliveryPayment =
    serviceOrigin === "external" || serviceOrigin === "simple_package"
      ? resolveExternalDeliveryPayment({
          delivered,
          buyerAmount: finalBuyerDebtAmount,
          paymentType: externalSale.tipo_de_pago ?? existing.tipo_de_pago,
          subtotalQr: externalSale.subtotal_qr ?? existing.subtotal_qr,
          subtotalEfectivo:
            latePickupFeeToApply > 0
              ? roundCurrency(toNumber(externalSale.subtotal_efectivo ?? existing.subtotal_efectivo, 0) + latePickupFeeToApply)
              : externalSale.subtotal_efectivo ?? existing.subtotal_efectivo,
        })
      : { tipoDePago: "", subtotalQr: 0, subtotalEfectivo: 0 };

  const updatePayload: any = {
    id_vendedor: existing.id_vendedor,
    carnet_vendedor: existing.carnet_vendedor,
    vendedor: existing.vendedor,
    telefono_vendedor: existing.telefono_vendedor,
    comprador: buyerName || undefined,
    telefono_comprador: buyerPhone || undefined,
    descripcion_paquete: existing.descripcion_paquete,
    package_size: nextPackageSize,
    delivery_spaces: deliverySpaces,
    precio_paquete: price,
    precio_total: totalPrice,
    esta_pagado: paid,
    monto_paga_vendedor: montoPagaVendedor,
    monto_paga_comprador: finalMontoPagaComprador,
    saldo_cobrar: serviceOrigin === "external" ? finalSaldoCobrar : finalBuyerDebtAmount,
    deuda_comprador: finalBuyerDebtAmount,
    metodo_pago: sellerPaymentMethod,
    tipo_de_pago: deliveryPayment.tipoDePago,
    subtotal_qr: deliveryPayment.subtotalQr,
    subtotal_efectivo: deliveryPayment.subtotalEfectivo,
    estado_pedido: status,
    delivered,
    late_pickup_fee: persistedLatePickupFee,
    is_external: true,
    service_origin: serviceOrigin,
  };

  if (serviceOrigin === "simple_package" || serviceOrigin === "external") {
    updatePayload.precio_entre_sucursal = branchRoutePrice;
    updatePayload.cargo_delivery = branchRoutePrice;
  }

  if (nextBranchRoute) {
    updatePayload.sucursal = toObjectIdOrUndefined(nextBranchRoute.originBranchId);
    updatePayload.origen_sucursal = toObjectIdOrUndefined(nextBranchRoute.originBranchId);
    updatePayload.destino_sucursal = toObjectIdOrUndefined(nextBranchRoute.destinationBranchId);
    updatePayload.lugar_entrega = nextBranchRoute.destinationBranchName || existing.lugar_entrega;
  } else if (destinationEditRequested && serviceOrigin === "simple_package") {
    updatePayload.destino_sucursal = toObjectIdOrUndefined(nextDestinationBranchId);
  }

  if (serviceOrigin === "simple_package" || serviceOrigin === "external") {
    updatePayload.costo_delivery = toNumber(externalSale.costo_delivery ?? existing.costo_delivery, 0);
    updatePayload.seller_debt_applied = !(sellerPaymentMethod && montoPagaVendedor > 0);
  }

  if (externalSale.fecha_pedido) {
    updatePayload.fecha_pedido = existing.fecha_pedido;
  }

  if (delivered && !externalSale.hora_entrega_real) {
    updatePayload.hora_entrega_real = deliveredAt;
  } else if (delivered && externalSale.hora_entrega_real) {
    updatePayload.hora_entrega_real = deliveredAt;
  } else if (!delivered) {
    updatePayload.hora_entrega_real = undefined;
  }

  if (externalSale.retirado_por_vendedor === true) {
    updatePayload.retirado_por_vendedor = true;
    updatePayload.seller_withdrawn_at = externalSale.seller_withdrawn_at || deliveredAt;
  }

  if (!nextBranchRoute) {
    updatePayload.sucursal = existing.sucursal;
  }

  const sellerId = String(existing.id_vendedor || "");
  const sellerPendingDelta = roundCurrency(simplePackageFinancials.sellerPending);
  const shouldApplySellerBalance =
    serviceOrigin === "simple_package" &&
    delivered &&
    !existing.seller_balance_applied &&
    sellerPendingDelta !== 0;
  const shouldRevertSellerBalance =
    serviceOrigin === "simple_package" &&
    !delivered &&
    existing.seller_balance_applied &&
    sellerPendingDelta !== 0;

  if (shouldApplySellerBalance) {
    await adjustSellerSaldoPendiente(sellerId, sellerPendingDelta);
    updatePayload.seller_balance_applied = true;
    updatePayload.deposito_realizado = false;
  } else if (shouldRevertSellerBalance) {
    await adjustSellerSaldoPendiente(sellerId, -sellerPendingDelta);
    updatePayload.seller_balance_applied = false;
    updatePayload.deposito_realizado = false;
  } else if (serviceOrigin === "simple_package") {
    updatePayload.seller_balance_applied = !!existing.seller_balance_applied;
    updatePayload.deposito_realizado = !!existing.deposito_realizado;
  }

  if (!delivered && existingDelivered && serviceOrigin !== "simple_package") {
    updatePayload.hora_entrega_real = undefined;
  }

  const previousSellerMethod = normalizeSellerPaymentMethod(existing.metodo_pago);
  const previousSellerAmount = roundCurrency(Number(existing.monto_paga_vendedor || 0));
  const updated = await ExternalSaleRepository.updateExternalSaleByID(id, updatePayload);

  if (updated && status === READY_FOR_PICKUP_STATUS && status !== existing.estado_pedido) {
    void OrderGuideWhatsappService.sendPickupReadyMessage(updated).catch((error) => {
      console.error("[external-service] pickup-whatsapp:error", {
        externalSaleId: id,
        error: error?.message || String(error),
      });
    });
  }

  if (serviceOrigin === "external" && paymentEditRequested && updated) {
    const branchId = String((existing.sucursal as any)?._id || existing.sucursal || "");
    if (previousSellerMethod && previousSellerAmount > 0) {
      await adjustExternalSellerIncome({
        paymentMethod: previousSellerMethod,
        amountDelta: -previousSellerAmount,
        branchId,
        date: existing.fecha_pedido,
      });
    }
    if (sellerPaymentMethod && montoPagaVendedor > 0) {
      await adjustExternalSellerIncome({
        paymentMethod: sellerPaymentMethod,
        amountDelta: montoPagaVendedor,
        branchId,
        date: existing.fecha_pedido,
      });
    }
  }

  return updated;
};

export const ExternalSaleService = {
  getAllExternalSales,
  getExternalSalesList,
  getExternalContactSuggestions,
  getExternalSaleByID,
  registerExternalSale,
  registerExternalSalesByPackages,
  deleteExternalSaleByID,
  updateExternalSaleByID,
};
