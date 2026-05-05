import moment from "moment-timezone";
import { Types } from "mongoose";
import { ExternalPaidStatus, IVentaExterna, PackagePaymentMethod } from "../entities/IVentaExterna";
import { ExternalSaleRepository } from "../repositories/external.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { SellerRepository } from "../repositories/seller.repository";
import { OrderGuideService } from "./orderGuide.service";
import { SimplePackageBranchPriceRepository } from "../repositories/simplePackageBranchPrice.repository";
import { SucursalModel } from "../entities/implements/SucursalSchema";

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
    };
  }

  const safeOriginBranchId = toTrimmed(originBranchId || destinationBranchId);
  const safeDestinationBranchId = toTrimmed(destinationBranchId || originBranchId);
  if (!Types.ObjectId.isValid(safeOriginBranchId) || !Types.ObjectId.isValid(safeDestinationBranchId)) {
    throw new Error("Debe seleccionar sucursales validas");
  }

  if (safeOriginBranchId === safeDestinationBranchId) {
    const branch = await SucursalModel.findById(safeOriginBranchId).select("nombre").lean();
    return {
      precioEntreSucursal: 0,
      originBranchId: safeOriginBranchId,
      destinationBranchId: safeDestinationBranchId,
      destinationBranchName: String((branch as any)?.nombre || "").trim(),
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
  const buyerName = toTrimmed(input.comprador ?? input.nombre_comprador);
  const buyerPhone = toTrimmed(input.telefono_comprador);
  if (!buyerName && !buyerPhone) {
    throw new Error("Debe ingresar al menos el nombre o el celular del comprador");
  }
};

const resolvePaymentSplit = (
  paidStatus: ExternalPaidStatus,
  packagePrice: number,
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
      montoPagaVendedor: +packagePrice.toFixed(2),
      montoPagaComprador: 0,
      saldoCobrar: 0,
    };
  }

  if (paidStatus === "no") {
    return {
      montoPagaVendedor: 0,
      montoPagaComprador: 0,
      saldoCobrar: +packagePrice.toFixed(2),
    };
  }

  const mixedTotal = +(montoPagaVendedor + montoPagaComprador).toFixed(2);
  if (packagePrice <= 0) {
    throw new Error("Para pago mixto el precio del paquete debe ser mayor a 0");
  }
  if (montoPagaVendedor <= 0 || montoPagaComprador <= 0) {
    throw new Error("En pago mixto ambos deben pagar un monto mayor a 0");
  }
  if (montoPagaVendedor >= packagePrice || montoPagaComprador >= packagePrice) {
    throw new Error("En pago mixto ninguna parte puede pagar todo el paquete");
  }
  if (Math.abs(mixedTotal - packagePrice) > 0.01) {
    throw new Error("En pago mixto la suma debe ser exactamente igual al precio del paquete");
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
  const packagePrice = toNumber(input.precio_paquete ?? input.precio_total, 0);
  const originBranchId = toTrimmed(input.origen_sucursal_id ?? input.origen_sucursal ?? input.sucursal ?? input.id_sucursal);
  const destinationBranchId = toTrimmed(input.destino_sucursal_id ?? input.destino_sucursal ?? originBranchId);
  const branchRoute = await resolveExternalBranchRoutePricing(originBranchId, destinationBranchId);
  const branchRoutePrice = branchRoute.precioEntreSucursal;
  const totalServicePrice = roundCurrency(packagePrice + branchRoutePrice);
  const buyerName = toTrimmed(input.comprador ?? input.nombre_comprador);
  const buyerPhone = toTrimmed(input.telefono_comprador);
  const initialDelivered = input.delivered === true || input.estado_pedido === "Entregado";
  const estadoPedido = normalizeOrderStatus(input.estado_pedido, initialDelivered);
  const delivered = estadoPedido === "Entregado";
  const { montoPagaVendedor, montoPagaComprador, saldoCobrar } = resolvePaymentSplit(
    paid,
    packagePrice,
    input.monto_paga_vendedor,
    input.monto_paga_comprador
  );
  const totalSaldoCobrar = roundCurrency(saldoCobrar + branchRoutePrice);
  const totalBuyerDebt =
    paid === "mixto"
      ? roundCurrency(montoPagaComprador + branchRoutePrice)
      : toNumber(input.deuda_comprador ?? totalSaldoCobrar ?? input.monto_paga_comprador ?? totalServicePrice, totalServicePrice);
  const sellerPaymentMethod =
    montoPagaVendedor > 0
      ? normalizeSellerPaymentMethod(input.metodo_pago ?? input.paymentMethod ?? input.seller_payment_method)
      : "";

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
    sucursal: toObjectIdOrUndefined(branchRoute.originBranchId),
    origen_sucursal: toObjectIdOrUndefined(branchRoute.originBranchId),
    destino_sucursal: toObjectIdOrUndefined(branchRoute.destinationBranchId),
    service_origin: "external",
    package_size: "estandar",
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
  return created;
};

const assignExternalGuideAndQR = async (record: IVentaExterna) => {
  await OrderGuideService.assignOrderGuide(record);
};

const registerExternalSalesByPackages = async (payload: any) => {
  const paquetes = Array.isArray(payload?.paquetes) ? payload.paquetes : [];
  if (!paquetes.length) throw new Error("Debe enviar al menos un paquete");

  const toCreate: IVentaExterna[] = await Promise.all(paquetes.map(async (pkg: any, index: number) => {
    const merged = {
      ...payload,
      ...pkg,
      numero_paquete: pkg?.numero_paquete ?? index + 1,
      fecha_pedido: payload?.fecha_pedido,
      carnet_vendedor: payload?.carnet_vendedor,
      vendedor: payload?.vendedor,
      telefono_vendedor: payload?.telefono_vendedor,
      origen_sucursal_id: payload?.origen_sucursal_id ?? payload?.originBranchId ?? payload?.sucursal ?? payload?.id_sucursal,
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
  return created;
};

const deleteExternalSaleByID = async (id: string) => {
  return await ExternalSaleRepository.deleteExternalSaleByID(id);
};

const updateExternalSaleByID = async (id: string, externalSale: any) => {
  const existing = await ExternalSaleRepository.getExternalSaleByID(id);
  if (!existing) return null;

  const buyerName = toTrimmed(externalSale.comprador ?? existing.comprador);
  const buyerPhone = toTrimmed(externalSale.telefono_comprador ?? existing.telefono_comprador);
  if (!buyerName && !buyerPhone) {
    throw new Error("Debe ingresar al menos el nombre o el celular del comprador");
  }

  const price = toNumber(
    externalSale.precio_paquete ?? existing.precio_paquete ?? externalSale.precio_total ?? existing.precio_total,
    0
  );
  const serviceOrigin = (String(existing.service_origin || "external").trim() || "external") as
    | "external"
    | "simple_package";
  const branchRoutePrice = roundCurrency(
    toNumber(
      externalSale.precio_entre_sucursal ??
        existing.precio_entre_sucursal ??
        externalSale.cargo_delivery ??
        existing.cargo_delivery,
      0
    )
  );
  const simplePackageFinancials = getSimplePackageFinancials({
    ...existing,
    ...externalSale,
    precio_paquete: price,
    precio_entre_sucursal: branchRoutePrice,
  });
  const amountToCharge =
    serviceOrigin === "simple_package" ? simplePackageFinancials.totalToCharge : price;
  const totalPrice =
    serviceOrigin === "simple_package" ? simplePackageFinancials.totalServicePrice : roundCurrency(price + branchRoutePrice);
  const paid = normalizePaidStatus(externalSale.esta_pagado ?? existing.esta_pagado);
  const status = normalizeOrderStatus(
    externalSale.estado_pedido ?? existing.estado_pedido,
    externalSale.delivered === true || existing.delivered === true
  );
  const delivered = status === "Entregado";
  const existingDelivered = existing.estado_pedido === "Entregado";

  const { montoPagaVendedor, montoPagaComprador, saldoCobrar } = resolvePaymentSplit(
    paid,
    amountToCharge,
    externalSale.monto_paga_vendedor ?? existing.monto_paga_vendedor,
    externalSale.monto_paga_comprador ?? existing.monto_paga_comprador
  );
  const buyerDebtAmount =
    serviceOrigin === "simple_package"
      ? toNumber(existing.deuda_comprador ?? externalSale.deuda_comprador, 0)
      : toNumber(
          externalSale.deuda_comprador ??
            existing.deuda_comprador ??
            roundCurrency(saldoCobrar + branchRoutePrice) ??
            roundCurrency(amountToCharge + branchRoutePrice),
          roundCurrency(amountToCharge + branchRoutePrice)
        );
  const existingSellerPaymentMethod = normalizeSellerPaymentMethod(existing.metodo_pago);
  const hasPaymentStatusUpdate = Object.prototype.hasOwnProperty.call(externalSale, "esta_pagado");
  const hasSellerMethodUpdate = Object.prototype.hasOwnProperty.call(externalSale, "metodo_pago");
  const hasSellerAmountUpdate =
    Object.prototype.hasOwnProperty.call(externalSale, "monto_paga_vendedor") ||
    Object.prototype.hasOwnProperty.call(externalSale, "monto_paga_comprador");
  const isLegacyMixedWithoutSellerMethod =
    existing.esta_pagado === "mixto" &&
    !existingSellerPaymentMethod &&
    !hasPaymentStatusUpdate &&
    !hasSellerMethodUpdate &&
    !hasSellerAmountUpdate;
  const sellerPaymentMethod = montoPagaVendedor > 0
    ? normalizeSellerPaymentMethod(externalSale.metodo_pago ?? existing.metodo_pago)
    : "";
  if (
    serviceOrigin === "external" &&
    montoPagaVendedor > 0 &&
    !sellerPaymentMethod &&
    !isLegacyMixedWithoutSellerMethod
  ) {
    throw new Error("Debe seleccionar si el pago del vendedor sera efectivo o QR");
  }
  const deliveryPayment =
    serviceOrigin === "external"
      ? resolveExternalDeliveryPayment({
          delivered,
          buyerAmount: buyerDebtAmount,
          paymentType: externalSale.tipo_de_pago ?? existing.tipo_de_pago,
          subtotalQr: externalSale.subtotal_qr ?? existing.subtotal_qr,
          subtotalEfectivo: externalSale.subtotal_efectivo ?? existing.subtotal_efectivo,
        })
      : {
          tipoDePago: String(existing.tipo_de_pago || ""),
          subtotalQr: roundCurrency(Number((existing as any)?.subtotal_qr || 0)),
          subtotalEfectivo: roundCurrency(Number((existing as any)?.subtotal_efectivo || 0)),
        };

  const updatePayload: any = {
    ...externalSale,
    comprador: buyerName || undefined,
    telefono_comprador: buyerPhone || undefined,
    precio_paquete: price,
    precio_total: totalPrice,
    esta_pagado: paid,
    monto_paga_vendedor: montoPagaVendedor,
    monto_paga_comprador: montoPagaComprador,
    saldo_cobrar: serviceOrigin === "external" ? roundCurrency(saldoCobrar + branchRoutePrice) : saldoCobrar,
    deuda_comprador: buyerDebtAmount,
    metodo_pago: sellerPaymentMethod,
    tipo_de_pago: deliveryPayment.tipoDePago,
    subtotal_qr: deliveryPayment.subtotalQr,
    subtotal_efectivo: deliveryPayment.subtotalEfectivo,
    estado_pedido: status,
    delivered,
    is_external: true,
    service_origin: serviceOrigin,
  };

  if (serviceOrigin === "simple_package" || serviceOrigin === "external") {
    updatePayload.precio_entre_sucursal = branchRoutePrice;
    updatePayload.cargo_delivery = branchRoutePrice;
  }

  if (serviceOrigin === "simple_package") {
    updatePayload.costo_delivery = toNumber(externalSale.costo_delivery ?? existing.costo_delivery, 0);
  }

  if (externalSale.fecha_pedido) {
    updatePayload.fecha_pedido = normalizeExternalDate(externalSale.fecha_pedido);
  }

  if (delivered && !externalSale.hora_entrega_real) {
    updatePayload.hora_entrega_real = normalizeExternalDate(existing.hora_entrega_real ?? existing.fecha_pedido);
  } else if (!delivered) {
    updatePayload.hora_entrega_real = undefined;
  }

  if (externalSale.id_sucursal) {
    updatePayload.sucursal = externalSale.id_sucursal;
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

  return await ExternalSaleRepository.updateExternalSaleByID(id, updatePayload);
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
