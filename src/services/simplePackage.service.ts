import moment from "moment-timezone";
import { Types } from "mongoose";
import { IVentaExterna, PackagePaymentMethod, PackageSize } from "../entities/IVentaExterna";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { SellerRepository } from "../repositories/seller.repository";
import { SimplePackageBranchPriceRepository } from "../repositories/simplePackageBranchPrice.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";
import { ShippingService } from "./shipping.service";
import { hasConfiguredSimplePackageService } from "../utils";
import { OrderGuideService } from "./orderGuide.service";
import { OrderGuideWhatsappService } from "./orderGuideWhatsapp.service";
import { PackageEscalationConfigService } from "./packageEscalationConfig.service";

const toTrimmed = (value: unknown): string => String(value ?? "").trim();

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value: number) => +Number(value || 0).toFixed(2);

const normalizeDate = (value?: unknown) => {
  if (value) {
    return moment.tz(value as string, "America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
  }
  return moment().tz("America/La_Paz").format("YYYY-MM-DD HH:mm:ss");
};

const normalizePackageSize = (value: unknown): PackageSize =>
  String(value || "").trim().toLowerCase() === "grande" ? "grande" : "estandar";

const normalizePaidStatus = (value: unknown): "si" | "no" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    value === true ||
    normalized === "si" ||
    normalized === "sí" ||
    normalized === "pagado" ||
    normalized === "paid"
  ) {
    return "si";
  }
  return "no";
};

const normalizePaymentMethod = (value: unknown): PackagePaymentMethod => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "efectivo" || normalized === "qr") return normalized;
  return "";
};

const toObjectIdOrUndefined = (value?: string) =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;

const ensureBuyerIdentity = (row: any) => {
  const buyerPhone = toTrimmed(row?.telefono_comprador);
  if (!buyerPhone) {
    throw new Error("Cada paquete debe tener celular del comprador");
  }
};

const ensureDescription = (row: any) => {
  if (!toTrimmed(row?.descripcion_paquete)) {
    throw new Error("Cada paquete debe tener descripcion");
  }
};

const resolveSeller = async (sellerId: string) => {
  if (!Types.ObjectId.isValid(sellerId)) {
    throw new Error("No se pudo identificar al vendedor");
  }

  const seller = await SellerRepository.findById(sellerId);
  if (!seller) {
    throw new Error("Vendedor no encontrado");
  }

  if (
    !hasConfiguredSimplePackageService({
      pago_sucursales: Array.isArray(seller?.pago_sucursales) ? seller.pago_sucursales : [],
    })
  ) {
    throw new Error("El vendedor no tiene habilitado el servicio por paquete");
  }

  return seller;
};

const getSellerSimpleBranchIds = (seller: any) =>
  new Set(
    (Array.isArray(seller?.pago_sucursales) ? seller.pago_sucursales : [])
      .filter((payment: any) => payment?.activo !== false && Number(payment?.entrega_simple ?? 0) > 0)
      .map((payment: any) => String(payment?.id_sucursal?._id || payment?.id_sucursal || "").trim())
      .filter(Boolean)
  );

const ensureSellerSimpleBranch = (seller: any, branchId?: string, label = "La sucursal") => {
  const normalizedBranchId = toTrimmed(branchId);
  if (!normalizedBranchId) {
    throw new Error(`${label} es obligatoria`);
  }

  const allowedBranches = getSellerSimpleBranchIds(seller);
  if (!allowedBranches.has(normalizedBranchId)) {
    throw new Error(`${label} no esta habilitada para entregas simples en este vendedor`);
  }
};

const resolveBranchRoutePricing = async (originBranchId?: string, destinationBranchId?: string) => {
  if (!originBranchId || !destinationBranchId) {
    return {
      precio_entre_sucursal: 0,
      originBranchName: "",
      destinationBranchName: "",
    };
  }

  if (String(originBranchId) === String(destinationBranchId)) {
    const route = await SimplePackageBranchPriceRepository.findPriceByRoute(originBranchId, destinationBranchId);
    const branch = await SucursalModel.findById(originBranchId).select("nombre").lean();
    const originBranchName = String((branch as any)?.nombre || "").trim();

    return {
      precio_entre_sucursal: 0,
      originBranchName,
      destinationBranchName: originBranchName,
      routeId: String((route as any)?._id || ""),
    };
  }

  const route = await SimplePackageBranchPriceRepository.findPriceByRoute(originBranchId, destinationBranchId);
  if (!route) {
    throw new Error("No existe un precio configurado entre las sucursales seleccionadas");
  }

  return {
    precio_entre_sucursal: roundCurrency(Number((route as any)?.precio || 0)),
    originBranchName: String((route as any)?.origen_sucursal?.nombre || "").trim(),
    destinationBranchName: String((route as any)?.destino_sucursal?.nombre || "").trim(),
    routeId: String((route as any)?._id || ""),
  };
};

const buildPackagePricing = (
  smallPackagePrice: number,
  amortizacion: number,
  saldoPorPaquete: number,
  packageSize: PackageSize,
  branchRoutePrice = 0,
  deliverySpaces = 1
) => {
  const precioPaqueteUnitario = roundCurrency(smallPackagePrice);
  const precioPaquete = roundCurrency(smallPackagePrice);
  const deudaVendedor = roundCurrency(amortizacion);
  const deudaComprador = roundCurrency(Math.max(0, precioPaquete + branchRoutePrice - deudaVendedor));
  const precioEntreSucursal = roundCurrency(branchRoutePrice);
  const precioTotal = roundCurrency(precioPaquete + precioEntreSucursal);

  return {
    precio_paquete_unitario: precioPaqueteUnitario,
    amortizacion_vendedor: deudaVendedor,
    saldo_por_paquete: roundCurrency(saldoPorPaquete),
    precio_paquete: precioPaquete,
    precio_entre_sucursal: precioEntreSucursal,
    delivery_spaces: Math.max(1, Number(deliverySpaces || 1)),
    precio_total: precioTotal,
    cargo_delivery: precioEntreSucursal,
    costo_delivery: 0,
    deuda_comprador: deudaComprador,
    monto_paga_vendedor: deudaVendedor,
    monto_paga_comprador: deudaComprador,
  };
};

const buildAccountingAmount = (row: any) =>
  roundCurrency(
    Number(row?.precio_paquete || 0) +
      Number(row?.saldo_por_paquete || 0) -
      Number(row?.amortizacion_vendedor || 0)
  );

const buildTotalAmountToCharge = (row: any) =>
  roundCurrency(
    Math.max(
      0,
      Number(row?.precio_paquete || 0) +
        Number(row?.saldo_por_paquete || 0) +
        Number(row?.precio_entre_sucursal || row?.cargo_delivery || 0) -
        Number(row?.amortizacion_vendedor || 0)
    )
  );

const resolveSimplePackagePaymentPayload = (row: any) => {
  const method = normalizePaymentMethod(row?.metodo_pago);
  const sellerDebtAmount = roundCurrency(Number(row?.amortizacion_vendedor || 0));

  if (!method) {
    return {
      esta_pagado: "no" as const,
      tipo_de_pago: "",
      subtotal_qr: 0,
      subtotal_efectivo: 0,
    };
  }

  return {
    esta_pagado: "no" as const,
    tipo_de_pago: method === "qr" ? "1" : "2",
    subtotal_qr: method === "qr" ? sellerDebtAmount : 0,
    subtotal_efectivo: method === "efectivo" ? sellerDebtAmount : 0,
  };
};

const applySimplePackageDebt = async (params: {
  sellerId: string;
  originBranchId?: string;
  amount: number;
  packageCount: number;
}) => {
  const amount = roundCurrency(params.amount);
  if (!params.sellerId || amount <= 0) return;

  await FinanceFluxRepository.registerFinanceFlux({
    tipo: "INGRESO",
    categoria: "SERVICIO",
    concepto:
      params.packageCount > 1
        ? `Paquetes simples sin pagar (${params.packageCount})`
        : "Paquete simple sin pagar",
    monto: amount,
    fecha: new Date(),
    esDeuda: true,
    visible_en_flujo_general: false,
    id_vendedor: new Types.ObjectId(params.sellerId),
    id_sucursal:
      params.originBranchId && Types.ObjectId.isValid(params.originBranchId)
        ? new Types.ObjectId(params.originBranchId)
        : undefined,
  });
  await SellerRepository.incrementDebt(params.sellerId, amount);
};

const applySimplePackageIncomeEffectivo = async (params: {
  sellerId: string;
  originBranchId?: string;
  amount: number;
  packageCount: number;
}) => {
  const amount = roundCurrency(params.amount);
  if (!params.sellerId || amount <= 0) return;

  await FinanceFluxRepository.registerFinanceFlux({
    tipo: "INGRESO",
    categoria: "SERVICIO",
    concepto:
      params.packageCount > 1
        ? `Paquetes simples en efectivo (${params.packageCount})`
        : "Paquete simple en efectivo",
    monto: amount,
    fecha: new Date(),
    esDeuda: false,
    visible_en_flujo_general: false,
    id_vendedor: new Types.ObjectId(params.sellerId),
    id_sucursal:
      params.originBranchId && Types.ObjectId.isValid(params.originBranchId)
        ? new Types.ObjectId(params.originBranchId)
        : undefined,
  });
};

const applySimplePackageIncomeQR = async (params: {
  sellerId: string;
  originBranchId?: string;
  amount: number;
  packageCount: number;
}) => {
  const amount = roundCurrency(params.amount);
  if (!params.sellerId || amount <= 0) return;

  await FinanceFluxRepository.registerFinanceFlux({
    tipo: "INGRESO",
    categoria: "SERVICIO",
    concepto:
      params.packageCount > 1
        ? `Paquetes simples en QR (${params.packageCount})`
        : "Paquete simple en QR",
    monto: amount,
    fecha: new Date(),
    esDeuda: false,
    visible_en_flujo_general: false,
    id_vendedor: new Types.ObjectId(params.sellerId),
    id_sucursal:
      params.originBranchId && Types.ObjectId.isValid(params.originBranchId)
        ? new Types.ObjectId(params.originBranchId)
        : undefined,
  });
};

const buildSimplePackageShippingPayload = (row: any) => {
  const buyerName = toTrimmed(row?.comprador) || `Paquete ${String(row?.numero_paquete || "").trim() || "simple"}`;
  const originBranchId = toTrimmed((row?.origen_sucursal as any)?._id ?? row?.origen_sucursal ?? row?.sucursal);
  const destinationBranchId = toTrimmed((row?.destino_sucursal as any)?._id ?? row?.destino_sucursal);
  const destinationBranchName = toTrimmed((row?.destino_sucursal as any)?.nombre ?? row?.lugar_entrega) || "Sucursal";
  const paymentData = resolveSimplePackagePaymentPayload(row);
  const tempProductPrice = roundCurrency(Number(row?.saldo_por_paquete || 0));

  return {
    cliente: buyerName,
    telefono_cliente: toTrimmed(row?.telefono_comprador),
    carnet_cliente: "",
    tipo_de_pago: paymentData.tipo_de_pago,
    fecha_pedido: normalizeDate(row?.fecha_pedido),
    hora_entrega_acordada: normalizeDate(row?.fecha_pedido),
    observaciones: "",
    lugar_origen: originBranchId || undefined,
    tipo_destino: "sucursal",
    sucursal: destinationBranchId || originBranchId || undefined,
    lugar_entrega: destinationBranchName,
    ubicacion_link: "",
    costo_delivery: 0,
    cargo_delivery: roundCurrency(Number(row?.precio_entre_sucursal ?? row?.cargo_delivery ?? 0)),
    estado_pedido: "En Espera",
    adelanto_cliente: 0,
    esta_pagado: paymentData.esta_pagado,
    pagado_al_vendedor: false,
    subtotal_qr: paymentData.subtotal_qr,
    subtotal_efectivo: paymentData.subtotal_efectivo,
    simple_package_order: true,
    simple_package_source_id: row?._id,
    numero_guia: row?.numero_guia || undefined,
    guia_sequence: row?.guia_sequence || undefined,
    productos_temporales: [
      {
        producto: toTrimmed(row?.descripcion_paquete) || "Paquete simple",
        cantidad: 1,
        precio_unitario: tempProductPrice,
        utilidad: 0,
        id_vendedor: row?.id_vendedor,
      },
    ],
    venta: [],
  };
};

const buildSimplePackageSalePayload = (row: any) => {
  const description = toTrimmed(row?.descripcion_paquete) || "Paquete simple";
  const originBranchId = toTrimmed((row?.origen_sucursal as any)?._id ?? row?.origen_sucursal ?? row?.sucursal);

  return {
    producto: description,
    nombre_variante: description,
    cantidad: 1,
    precio_unitario: roundCurrency(Number(row?.saldo_por_paquete || 0)),
    utilidad: 0,
    id_vendedor: String(row?.id_vendedor || ""),
    sucursal: originBranchId,
    id_sucursal: originBranchId,
  };
};

const buildSimplePackageRecord = async (params: {
  row: any;
  index: number;
  packageNumber: number;
  seller: any;
  sellerId: string;
  originBranchId?: string;
  allowManualBranchPrice?: boolean;
}) => {
  const { row, index, packageNumber, seller, sellerId, originBranchId, allowManualBranchPrice } = params;
  ensureBuyerIdentity(row);
  ensureDescription(row);
  ensureSellerSimpleBranch(seller, originBranchId, "La sucursal de origen");

  const saldoPorPaquete = roundCurrency(Math.max(0, toNumber(row?.saldo_por_paquete ?? 0)));
  const destinationBranchId = toTrimmed(row?.destino_sucursal_id ?? row?.destino_sucursal);
  if (!destinationBranchId) {
    throw new Error(`Paquete ${index + 1}: debe seleccionar una sucursal destino`);
  }
  ensureSellerSimpleBranch(seller, destinationBranchId, "La sucursal destino");

  const branchRoutePricing = await resolveBranchRoutePricing(originBranchId, destinationBranchId);
  const requestedDeliverySpaces = Math.max(1, toNumber(row?.delivery_spaces ?? 1, 1));
  const packageSize = await PackageEscalationConfigService.resolvePackageSizeBySpaces({
    routeId: branchRoutePricing.routeId,
    deliverySpaces: requestedDeliverySpaces,
    fallbackSize: normalizePackageSize(row?.package_size ?? row?.tamano),
  }) as PackageSize;
  const deliveryPricing =
    String(originBranchId || "") === String(destinationBranchId || "")
      ? { total: 0, spaces: 1 }
      : await PackageEscalationConfigService.getDeliveryPricing({
          routeId: branchRoutePricing.routeId,
          packageCount: index + 1,
          packageSize,
          deliverySpaces: requestedDeliverySpaces,
          fallbackRoutePrice: branchRoutePricing.precio_entre_sucursal,
        });
  const branchRoutePrice =
    String(originBranchId || "") === String(destinationBranchId || "")
      ? 0
      : allowManualBranchPrice &&
          row?.precio_entre_sucursal !== undefined &&
          row?.precio_entre_sucursal !== null &&
          String(row?.precio_entre_sucursal).trim() !== ""
        ? roundCurrency(Math.max(0, toNumber(row?.precio_entre_sucursal, deliveryPricing.total)))
        : deliveryPricing.total;
  const precioPaquete = await PackageEscalationConfigService.getSimpleUnitPrice({
    routeId: branchRoutePricing.routeId,
    sellerId,
    packageIndexInBatch: index,
    packageSize,
  });
  const precioPaqueteUnitario = precioPaquete;
  const amortizacionVendedor = roundCurrency(toNumber(row?.amortizacion_vendedor ?? seller?.amortizacion ?? 0));
  if (amortizacionVendedor < 0) {
    throw new Error(`Paquete ${index + 1}: el monto que cubrira el vendedor no puede ser menor a 0`);
  }
  if (amortizacionVendedor > precioPaquete) {
    throw new Error(`Paquete ${index + 1}: el monto que cubrira el vendedor no puede ser mayor al precio del paquete`);
  }
  const pricing = buildPackagePricing(
    precioPaqueteUnitario,
    amortizacionVendedor,
    saldoPorPaquete,
    packageSize,
    branchRoutePrice,
    requestedDeliverySpaces
  );

  const paymentMethod = normalizePaymentMethod(row?.metodo_pago);
  const sellerFullName = `${seller?.nombre || ""} ${seller?.apellido || ""}`.trim();
  const sellerBrand = toTrimmed(seller?.marca);
  const displaySellerName = sellerBrand && sellerFullName
    ? `${sellerBrand} - ${sellerFullName}`
    : sellerBrand || sellerFullName;

  return {
    id_vendedor: new Types.ObjectId(sellerId),
    carnet_vendedor: toTrimmed(seller?.carnet ?? row?.carnet_vendedor ?? "SN"),
    vendedor: displaySellerName || toTrimmed(row?.vendedor || "Vendedor"),
    telefono_vendedor: toTrimmed(seller?.telefono ?? row?.telefono_vendedor) || undefined,
    numero_paquete: packageNumber,
    comprador: toTrimmed(row?.comprador) || undefined,
    descripcion_paquete: toTrimmed(row?.descripcion_paquete),
    telefono_comprador: toTrimmed(row?.telefono_comprador) || undefined,
    fecha_pedido: normalizeDate(row?.fecha_pedido) as unknown as Date,
    service_origin: "simple_package" as const,
    package_size: packageSize,
    metodo_pago: paymentMethod,
    esta_pagado: "no",
    saldo_cobrar: buildTotalAmountToCharge(pricing),
    estado_pedido: "En Espera",
    delivered: false,
    is_external: false,
    seller_balance_applied: false,
    sucursal: toObjectIdOrUndefined(originBranchId),
    origen_sucursal: toObjectIdOrUndefined(originBranchId),
    destino_sucursal: toObjectIdOrUndefined(destinationBranchId),
    lugar_entrega: branchRoutePricing.destinationBranchName || "Paquete simple",
    ...pricing,
  } satisfies IVentaExterna;
};

const adjustSellerSaldoPendiente = async (sellerId: string, delta: number) => {
  if (!sellerId || !Number.isFinite(delta) || delta === 0) return;
  const seller = await SellerRepository.findById(sellerId);
  if (!seller) return;
  await SellerRepository.updateSeller(sellerId, {
    saldo_pendiente: roundCurrency(Number(seller?.saldo_pendiente || 0) + delta),
  });
};

const registerSimplePackages = async (params: {
  sellerId: string;
  paquetes: any[];
  originBranchId?: string;
  role?: string;
}) => {
  const { sellerId, paquetes, originBranchId, role } = params;
  if (!Array.isArray(paquetes) || !paquetes.length) {
    throw new Error("Debe enviar al menos un paquete");
  }

  const seller = await resolveSeller(sellerId);
  const startPackageNumber = await SimplePackageRepository.getNextPackageNumberForSeller(sellerId);
  const rows = await Promise.all(
    paquetes.map((row, index) =>
      buildSimplePackageRecord({
        row,
        index,
        packageNumber: startPackageNumber + index,
        seller,
        sellerId,
        originBranchId,
        allowManualBranchPrice: role === "admin" || role === "operator" || role === "superadmin",
      })
    )
  );

  const created = await SimplePackageRepository.registerSimplePackages(rows);
  return created;
};

const createSimplePackageOrders = async (params: {
  packageIds: string[];
  role: string;
  currentBranchId?: string;
  paymentMethod?: "efectivo" | "qr" | "";
}) => {
  const role = String(params.role || "").toLowerCase();
  const paymentMethod = normalizePaymentMethod(params.paymentMethod || "");
  const rows = await SimplePackageRepository.getSimplePackagesByIDs(params.packageIds || []);
  const pendingRows = rows.filter((row: any) => !row?.is_external);
  if (!pendingRows.length) {
    throw new Error("No hay paquetes pendientes para crear");
  }

  const missingPrintedLabel = pendingRows.filter((row: any) => !row?.qr_impreso || !row?.numero_guia);
  if (missingPrintedLabel.length) {
    throw new Error("Debe imprimir las etiquetas antes de crear los pedidos simples");
  }

  if (
    (role === "admin" || role === "operator") &&
    params.currentBranchId &&
    pendingRows.some((row: any) => String((row?.origen_sucursal as any)?._id || row?.origen_sucursal || "") !== String(params.currentBranchId))
  ) {
    throw new Error("Solo puedes crear pedidos de paquetes de tu sucursal actual");
  }

  const shippingResults = [];
  let debtAmount = 0;
  let debtCount = 0;
  let effectivoAmount = 0;
  let effectivoCount = 0;
  let qrAmount = 0;
  let qrCount = 0;

  for (const row of pendingRows as any[]) {
    const shippingPayload = buildSimplePackageShippingPayload(row);
    const salePayload = buildSimplePackageSalePayload(row);
    const createdShipping = await ShippingService.registerShipping(shippingPayload);

    try {
      await ShippingService.processSalesForShipping(String(createdShipping._id), [salePayload]);

      const sellerAmortizacion = roundCurrency(Number(row?.amortizacion_vendedor || 0));
      
      if (paymentMethod === "efectivo") {
        effectivoAmount += sellerAmortizacion;
        effectivoCount += 1;
      } else if (paymentMethod === "qr") {
        qrAmount += sellerAmortizacion;
        qrCount += 1;
      } else {
        // No payment method specified - register as debt
        debtAmount += sellerAmortizacion;
        debtCount += 1;
      }

      const updatedRow = await SimplePackageRepository.updateSimplePackageByID(String(row._id), {
        is_external: true,
        pedido_ref: createdShipping._id,
        estado_pedido: createdShipping.estado_pedido,
        delivered: createdShipping.estado_pedido === "Entregado",
        seller_balance_applied: createdShipping.estado_pedido === "Entregado",
        seller_debt_applied: !paymentMethod,
        esta_pagado: "no",
        metodo_pago: paymentMethod,
      });

      shippingResults.push({
        packageId: row._id,
        shippingId: createdShipping._id,
        row: updatedRow,
      });
    } catch (error) {
      await ShippingService.deleteShippingById(String(createdShipping._id));
      throw error;
    }
  }

  const sellerId = String((pendingRows[0] as any)?.id_vendedor || "");
  const originBranchId = String(((pendingRows[0] as any)?.origen_sucursal as any)?._id || (pendingRows[0] as any)?.origen_sucursal || "");

  if (debtAmount > 0) {
    await applySimplePackageDebt({
      sellerId,
      originBranchId,
      amount: debtAmount,
      packageCount: debtCount,
    });
  }

  if (effectivoAmount > 0) {
    await applySimplePackageIncomeEffectivo({
      sellerId,
      originBranchId,
      amount: effectivoAmount,
      packageCount: effectivoCount,
    });
  }

  if (qrAmount > 0) {
    await applySimplePackageIncomeQR({
      sellerId,
      originBranchId,
      amount: qrAmount,
      packageCount: qrCount,
    });
  }

  const rowsToNotify = shippingResults.map((result: any) => result.row).filter(Boolean);
  void OrderGuideWhatsappService.sendForRowsBestEffort(rowsToNotify, "simple-package-guide-whatsapp");

  return shippingResults;
};

const printSimplePackageGuides = async (params: {
  packageIds: string[];
  role: string;
  authSellerId?: string;
  currentBranchId?: string;
}) => {
  const packageIds = (params.packageIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!packageIds.length) return [];

  const role = String(params.role || "").toLowerCase();
  const rows = await SimplePackageRepository.getSimplePackagesByIDs(packageIds);
  const pendingRows = rows.filter((row: any) => !row?.is_external);

  if (!pendingRows.length) return [];

  if (
    role === "seller" &&
    pendingRows.some((row: any) => String(row?.id_vendedor || "") !== String(params.authSellerId || ""))
  ) {
    throw new Error("No autorizado para imprimir estos paquetes");
  }

  if (
    (role === "admin" || role === "operator") &&
    params.currentBranchId &&
    pendingRows.some((row: any) => String((row?.origen_sucursal as any)?._id || row?.origen_sucursal || "") !== String(params.currentBranchId))
  ) {
    throw new Error("Solo puedes imprimir etiquetas de paquetes de tu sucursal actual");
  }

  const rowsToPrint = pendingRows.filter((row: any) => !row?.qr_impreso || !row?.numero_guia);

  const printedRows = [];
  for (const row of rowsToPrint as any[]) {
    const packageId = String(row._id);
    const guideData: any =
      typeof row?.toObject === "function"
        ? row.toObject()
        : { ...row };

    await OrderGuideService.assignOrderGuide(guideData);

    const updated = await SimplePackageRepository.updateSimplePackageByID(packageId, {
      numero_guia: guideData.numero_guia,
      guia_sequence: guideData.guia_sequence,
      qr_impreso: true,
      qr_impreso_at: new Date(),
    } as Partial<IVentaExterna>);

    if (updated) printedRows.push(updated);
  }

  return printedRows;
};

const getSimplePackagesList = async (params: {
  sellerId: string;
  originBranchId?: string;
  from?: Date;
  to?: Date;
}) => {
  return await SimplePackageRepository.getSimplePackagesList(params);
};

const getUploadedSimplePackageSellers = async (originBranchId?: string) => {
  return await SimplePackageRepository.getUploadedSimplePackageSellers(originBranchId);
};

const getSellerAccountingSimplePackages = async (sellerId: string) => {
  const rows = await SimplePackageRepository.getSellerAccountingSimplePackages(sellerId);

  return rows.map((row: any) => ({
    ...row,
    accounting_amount: buildAccountingAmount(row),
  }));
};

const getSimplePackageBranchPrices = async (originBranchId?: string) => {
  return await SimplePackageBranchPriceRepository.listBranchPrices(originBranchId);
};

const upsertSimplePackageBranchPrice = async (params: {
  originBranchId: string;
  destinationBranchId: string;
  precio: number;
}) => {
  const originBranchId = toTrimmed(params.originBranchId);
  const destinationBranchId = toTrimmed(params.destinationBranchId);
  if (!Types.ObjectId.isValid(originBranchId) || !Types.ObjectId.isValid(destinationBranchId)) {
    throw new Error("Debe seleccionar sucursales validas");
  }
  const precio = roundCurrency(toNumber(params.precio, 0));
  if (precio < 0) {
    throw new Error("El precio entre sucursales no puede ser negativo");
  }

  return await SimplePackageBranchPriceRepository.upsertBranchPrice(
    originBranchId,
    destinationBranchId,
    precio
  );
};

const updateSimplePackageByID = async (params: {
  id: string;
  payload: any;
  role: string;
  authSellerId?: string;
}) => {
  const existing = await SimplePackageRepository.getSimplePackageByID(params.id);
  if (!existing) return null;
  if ((existing as any).qr_impreso || (existing as any).numero_guia) {
    throw new Error("No se puede modificar un paquete con QR impreso");
  }

  const role = String(params.role || "").toLowerCase();
  const existingSellerId = String(existing.id_vendedor || "");
  if (role === "seller" && existingSellerId !== String(params.authSellerId || "")) {
    throw new Error("No autorizado para este paquete");
  }

  const isPrivileged = role === "admin" || role === "operator" || role === "superadmin";
  const seller = await resolveSeller(existingSellerId);
  const nextOriginBranchId = toTrimmed(
    params.payload?.origen_sucursal_id ??
      params.payload?.origen_sucursal ??
      (existing as any)?.origen_sucursal?._id ??
      existing.origen_sucursal ??
      (existing as any)?.sucursal?._id ??
      existing.sucursal
  );
  const nextDestinationBranchId = toTrimmed(
    params.payload?.destino_sucursal_id ??
      params.payload?.destino_sucursal ??
      (existing as any)?.destino_sucursal?._id ??
      existing.destino_sucursal
  );
  ensureSellerSimpleBranch(seller, nextOriginBranchId, "La sucursal de origen");
  ensureSellerSimpleBranch(seller, nextDestinationBranchId, "La sucursal destino");
  const nextSaldoPorPaquete = roundCurrency(
    Math.max(
      0,
      toNumber(
        role === "seller" ? params.payload?.saldo_por_paquete ?? existing.saldo_por_paquete : existing.saldo_por_paquete,
        0
      )
    )
  );
  const manualBranchRoutePriceRaw = isPrivileged ? params.payload?.precio_entre_sucursal : undefined;
  const hasManualBranchRoutePrice =
    manualBranchRoutePriceRaw !== undefined &&
    manualBranchRoutePriceRaw !== null &&
    String(manualBranchRoutePriceRaw).trim() !== "";
  const resolvedBranchRoutePricing = await resolveBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId);
  const nextDeliverySpaces = Math.max(1, toNumber(params.payload?.delivery_spaces ?? (existing as any).delivery_spaces ?? 1, 1));
  const nextPackageSize = await PackageEscalationConfigService.resolvePackageSizeBySpaces({
    routeId: resolvedBranchRoutePricing.routeId,
    deliverySpaces: nextDeliverySpaces,
    fallbackSize: normalizePackageSize(params.payload?.package_size ?? existing.package_size),
  }) as PackageSize;
  const nextDeliveryPricing =
    String(nextOriginBranchId) === String(nextDestinationBranchId)
      ? { total: 0, spaces: 1 }
      : await PackageEscalationConfigService.getDeliveryPricing({
          routeId: resolvedBranchRoutePricing.routeId,
          packageCount: Number((existing as any)?.numero_paquete || 1),
          packageSize: nextPackageSize,
          deliverySpaces: nextDeliverySpaces,
          fallbackRoutePrice: resolvedBranchRoutePricing.precio_entre_sucursal,
        });
  const nextBranchRoutePrice =
    String(nextOriginBranchId) === String(nextDestinationBranchId)
      ? 0
      : roundCurrency(
          hasManualBranchRoutePrice
            ? Math.max(0, toNumber(manualBranchRoutePriceRaw, Number(existing.precio_entre_sucursal || 0)))
            : nextDeliveryPricing.total
        );
  const branchRoutePricing =
    String(nextOriginBranchId) === String(nextDestinationBranchId)
      ? resolvedBranchRoutePricing
      : hasManualBranchRoutePrice
        ? {
            ...resolvedBranchRoutePricing,
            precio_entre_sucursal: nextBranchRoutePrice,
          }
        : { ...resolvedBranchRoutePricing, precio_entre_sucursal: nextBranchRoutePrice };
  const nextPrecioPaquete = roundCurrency(toNumber(existing.precio_paquete, existing.precio_paquete_unitario || 0));
  const nextAmortizacionVendedor = roundCurrency(
    toNumber(
      role === "seller"
        ? params.payload?.amortizacion_vendedor ?? existing.amortizacion_vendedor
        : existing.amortizacion_vendedor,
      0
    )
  );
  if (nextAmortizacionVendedor < 0) {
    throw new Error("El monto que cubrira el vendedor no puede ser menor a 0");
  }
  if (nextAmortizacionVendedor > nextPrecioPaquete) {
    throw new Error("El monto que cubrira el vendedor no puede ser mayor al precio del paquete");
  }
  const pricing = buildPackagePricing(
    nextPrecioPaquete,
    nextAmortizacionVendedor,
    nextSaldoPorPaquete,
    nextPackageSize,
    nextBranchRoutePrice,
    nextDeliverySpaces
  );

  const updatePayload: Partial<IVentaExterna> = {
    package_size: nextPackageSize,
    sucursal: toObjectIdOrUndefined(nextOriginBranchId),
    origen_sucursal: toObjectIdOrUndefined(nextOriginBranchId),
    destino_sucursal: toObjectIdOrUndefined(nextDestinationBranchId),
    lugar_entrega: branchRoutePricing.destinationBranchName || existing.lugar_entrega,
    ...pricing,
  };

  if (role === "seller") {
    const nextBuyer = toTrimmed(params.payload?.comprador ?? existing.comprador);
    const nextPhone = toTrimmed(params.payload?.telefono_comprador ?? existing.telefono_comprador);
    if (!nextPhone) {
      throw new Error("Debe ingresar el celular del comprador");
    }
    const nextDescription = toTrimmed(params.payload?.descripcion_paquete ?? existing.descripcion_paquete);
    if (!nextDescription) {
      throw new Error("La descripcion del paquete es obligatoria");
    }

    updatePayload.comprador = nextBuyer || undefined;
    updatePayload.telefono_comprador = nextPhone || undefined;
    updatePayload.descripcion_paquete = nextDescription;
    updatePayload.amortizacion_vendedor = nextAmortizacionVendedor;
    updatePayload.saldo_por_paquete = nextSaldoPorPaquete;
  }

  if (isPrivileged) {
    const method = normalizePaymentMethod(params.payload?.metodo_pago ?? existing.metodo_pago);
    updatePayload.esta_pagado = "no";
    updatePayload.metodo_pago = method;
    updatePayload.saldo_cobrar = buildTotalAmountToCharge(pricing);
    updatePayload.precio_entre_sucursal = pricing.precio_entre_sucursal;
    if (typeof params.payload?.is_external === "boolean") {
      updatePayload.is_external = params.payload.is_external;
    }
  }

  return await SimplePackageRepository.updateSimplePackageByID(params.id, updatePayload);
};

const deleteSimplePackageByID = async (params: {
  id: string;
  role: string;
  authSellerId?: string;
}) => {
  const existing = await SimplePackageRepository.getSimplePackageByID(params.id);
  if (!existing) return null;
  if ((existing as any).qr_impreso || (existing as any).numero_guia) {
    throw new Error("No se puede eliminar un paquete con QR impreso");
  }

  const role = String(params.role || "").toLowerCase();
  const existingSellerId = String(existing.id_vendedor || "");
  if (role === "seller" && existingSellerId !== String(params.authSellerId || "")) {
    throw new Error("No autorizado para este paquete");
  }

  const deleted = await SimplePackageRepository.deleteSimplePackageByID(params.id);
  if (deleted) {
    if (existing.seller_balance_applied) {
      await adjustSellerSaldoPendiente(existingSellerId, -roundCurrency(Number(existing.saldo_por_paquete || 0)));
    }
  }
  return deleted;
};

const markSellerAccountingSimplePackagesDeposited = async (sellerId: string) => {
  return await SimplePackageRepository.markSellerAccountingSimplePackagesDeposited(sellerId);
};

export const SimplePackageService = {
  registerSimplePackages,
  getSimplePackagesList,
  getUploadedSimplePackageSellers,
  getSellerAccountingSimplePackages,
  createSimplePackageOrders,
  printSimplePackageGuides,
  getSimplePackageBranchPrices,
  upsertSimplePackageBranchPrice,
  updateSimplePackageByID,
  deleteSimplePackageByID,
  markSellerAccountingSimplePackagesDeposited,
};
