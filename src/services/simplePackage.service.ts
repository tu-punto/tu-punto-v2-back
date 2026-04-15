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
  const buyerName = toTrimmed(row?.comprador);
  const buyerPhone = toTrimmed(row?.telefono_comprador);
  if (!buyerName && !buyerPhone) {
    throw new Error("Cada paquete debe tener al menos nombre o celular del comprador");
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
    const branch = await SucursalModel.findById(originBranchId).select("nombre").lean();
    const originBranchName = String((branch as any)?.nombre || "").trim();

    return {
      precio_entre_sucursal: 0,
      originBranchName,
      destinationBranchName: originBranchName,
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
  };
};

const buildPackagePricing = (
  unitPrice: number,
  amortizacion: number,
  saldoPorPaquete: number,
  packageSize: PackageSize,
  branchRoutePrice = 0
) => {
  const priceMultiplier = packageSize === "grande" ? 2 : 1;
  const precioPaqueteUnitario = roundCurrency(unitPrice);
  const precioPaquete = roundCurrency(precioPaqueteUnitario * priceMultiplier);
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
  const paid = normalizePaidStatus(row?.esta_pagado);
  const totalToCharge = buildTotalAmountToCharge(row);
  const method = normalizePaymentMethod(row?.metodo_pago);

  if (paid !== "si" || !method) {
    return {
      esta_pagado: "no" as const,
      tipo_de_pago: "",
      subtotal_qr: 0,
      subtotal_efectivo: 0,
    };
  }

  return {
    esta_pagado: "si" as const,
    tipo_de_pago: method === "qr" ? "1" : "2",
    subtotal_qr: method === "qr" ? totalToCharge : 0,
    subtotal_efectivo: method === "efectivo" ? totalToCharge : 0,
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
    id_vendedor: new Types.ObjectId(params.sellerId),
    id_sucursal:
      params.originBranchId && Types.ObjectId.isValid(params.originBranchId)
        ? new Types.ObjectId(params.originBranchId)
        : undefined,
  });
  await SellerRepository.incrementDebt(params.sellerId, amount);
};

const buildSimplePackageShippingPayload = (row: any) => {
  const buyerName = toTrimmed(row?.comprador) || `Paquete ${String(row?.numero_paquete || "").trim() || "simple"}`;
  const originBranchId = toTrimmed((row?.origen_sucursal as any)?._id ?? row?.origen_sucursal ?? row?.sucursal);
  const destinationBranchId = toTrimmed((row?.destino_sucursal as any)?._id ?? row?.destino_sucursal);
  const destinationBranchName = toTrimmed((row?.destino_sucursal as any)?.nombre ?? row?.lugar_entrega) || "Sucursal";
  const amountToCharge = buildTotalAmountToCharge(row);
  const paymentData = resolveSimplePackagePaymentPayload(row);

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
    productos_temporales: [
      {
        producto: toTrimmed(row?.descripcion_paquete) || "Paquete simple",
        cantidad: 1,
        precio_unitario: amountToCharge,
        utilidad: 0,
        id_vendedor: row?.id_vendedor,
      },
    ],
    venta: [],
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

  const packageSize = normalizePackageSize(row?.package_size ?? row?.tamano);
  const saldoPorPaquete = roundCurrency(Math.max(0, toNumber(row?.saldo_por_paquete ?? 0)));
  const destinationBranchId = toTrimmed(row?.destino_sucursal_id ?? row?.destino_sucursal);
  if (!destinationBranchId) {
    throw new Error(`Paquete ${index + 1}: debe seleccionar una sucursal destino`);
  }
  ensureSellerSimpleBranch(seller, destinationBranchId, "La sucursal destino");

  const branchRoutePricing = await resolveBranchRoutePricing(originBranchId, destinationBranchId);
  const branchRoutePrice =
    String(originBranchId || "") === String(destinationBranchId || "")
      ? 0
      : allowManualBranchPrice &&
          row?.precio_entre_sucursal !== undefined &&
          row?.precio_entre_sucursal !== null &&
          String(row?.precio_entre_sucursal).trim() !== ""
        ? roundCurrency(Math.max(0, toNumber(row?.precio_entre_sucursal, branchRoutePricing.precio_entre_sucursal)))
        : branchRoutePricing.precio_entre_sucursal;
  const precioPaqueteUnitario = toNumber(seller?.precio_paquete ?? 0);
  const precioPaquete = roundCurrency(precioPaqueteUnitario * (packageSize === "grande" ? 2 : 1));
  const amortizacionVendedor = roundCurrency(toNumber(row?.amortizacion_vendedor ?? seller?.amortizacion ?? 0));
  if (amortizacionVendedor <= 0) {
    throw new Error(`Paquete ${index + 1}: el monto que cubrira el vendedor debe ser mayor a 0`);
  }
  if (amortizacionVendedor > precioPaquete) {
    throw new Error(`Paquete ${index + 1}: el monto que cubrira el vendedor no puede ser mayor al precio del paquete`);
  }
  const pricing = buildPackagePricing(
    precioPaqueteUnitario,
    amortizacionVendedor,
    saldoPorPaquete,
    packageSize,
    branchRoutePrice
  );

  const paid = normalizePaidStatus(row?.esta_pagado);
  const paymentMethod = paid === "si" ? normalizePaymentMethod(row?.metodo_pago) : "";
  const displaySellerName =
    toTrimmed(seller?.marca) || `${seller?.nombre || ""} ${seller?.apellido || ""}`.trim();

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
    esta_pagado: paid,
    saldo_cobrar: paid === "si" ? 0 : buildTotalAmountToCharge(pricing),
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
}) => {
  const role = String(params.role || "").toLowerCase();
  const rows = await SimplePackageRepository.getSimplePackagesByIDs(params.packageIds || []);
  const pendingRows = rows.filter((row: any) => !row?.is_external);
  if (!pendingRows.length) {
    throw new Error("No hay paquetes pendientes para crear");
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

  for (const row of pendingRows as any[]) {
    const shippingPayload = buildSimplePackageShippingPayload(row);
    const createdShipping = await ShippingService.registerShipping(shippingPayload);

    const isUnpaid = normalizePaidStatus(row?.esta_pagado) !== "si";
    if (isUnpaid) {
      debtAmount += roundCurrency(Number(row?.amortizacion_vendedor || 0));
      debtCount += 1;
    }

    const updatedRow = await SimplePackageRepository.updateSimplePackageByID(String(row._id), {
      is_external: true,
      pedido_ref: createdShipping._id,
      estado_pedido: createdShipping.estado_pedido,
      delivered: createdShipping.estado_pedido === "Entregado",
      seller_balance_applied: createdShipping.estado_pedido === "Entregado",
      seller_debt_applied: isUnpaid,
      esta_pagado: createdShipping.esta_pagado === "si" ? "si" : "no",
      metodo_pago:
        createdShipping.subtotal_qr > 0
          ? "qr"
          : createdShipping.subtotal_efectivo > 0
            ? "efectivo"
            : "",
    });

    shippingResults.push({
      packageId: row._id,
      shippingId: createdShipping._id,
      row: updatedRow,
    });
  }

  if (debtAmount > 0) {
    await applySimplePackageDebt({
      sellerId: String((pendingRows[0] as any)?.id_vendedor || ""),
      originBranchId: String(((pendingRows[0] as any)?.origen_sucursal as any)?._id || (pendingRows[0] as any)?.origen_sucursal || ""),
      amount: debtAmount,
      packageCount: debtCount,
    });
  }

  return shippingResults;
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
  if (originBranchId === destinationBranchId) {
    throw new Error("La sucursal origen y destino no pueden ser la misma");
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

  const role = String(params.role || "").toLowerCase();
  const existingSellerId = String(existing.id_vendedor || "");
  if (role === "seller" && existingSellerId !== String(params.authSellerId || "")) {
    throw new Error("No autorizado para este paquete");
  }

  const isPrivileged = role === "admin" || role === "operator" || role === "superadmin";
  const seller = await resolveSeller(existingSellerId);
  const nextPackageSize = normalizePackageSize(params.payload?.package_size ?? existing.package_size);
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
  const nextBranchRoutePrice =
    String(nextOriginBranchId) === String(nextDestinationBranchId)
      ? 0
      : roundCurrency(
          hasManualBranchRoutePrice
            ? Math.max(0, toNumber(manualBranchRoutePriceRaw, Number(existing.precio_entre_sucursal || 0)))
            : toNumber((await resolveBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId)).precio_entre_sucursal, 0)
        );
  const branchRoutePricing =
    String(nextOriginBranchId) === String(nextDestinationBranchId)
      ? await resolveBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId)
      : hasManualBranchRoutePrice
        ? {
            ...(await resolveBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId)),
            precio_entre_sucursal: nextBranchRoutePrice,
          }
        : await resolveBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId);
  const nextPrecioPaquete = roundCurrency(
    toNumber(existing.precio_paquete_unitario, 0) * (nextPackageSize === "grande" ? 2 : 1)
  );
  const nextAmortizacionVendedor = roundCurrency(
    toNumber(
      role === "seller"
        ? params.payload?.amortizacion_vendedor ?? existing.amortizacion_vendedor
        : existing.amortizacion_vendedor,
      0
    )
  );
  if (nextAmortizacionVendedor <= 0) {
    throw new Error("El monto que cubrira el vendedor debe ser mayor a 0");
  }
  if (nextAmortizacionVendedor > nextPrecioPaquete) {
    throw new Error("El monto que cubrira el vendedor no puede ser mayor al precio del paquete");
  }
  const pricing = buildPackagePricing(
    toNumber(existing.precio_paquete_unitario, 0),
    nextAmortizacionVendedor,
    nextSaldoPorPaquete,
    nextPackageSize,
    nextBranchRoutePrice
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
    if (!nextBuyer && !nextPhone) {
      throw new Error("Debe ingresar al menos nombre o celular del comprador");
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
    const paid = normalizePaidStatus(params.payload?.esta_pagado ?? existing.esta_pagado);
    const method = paid === "si" ? normalizePaymentMethod(params.payload?.metodo_pago ?? existing.metodo_pago) : "";
    updatePayload.esta_pagado = paid;
    updatePayload.metodo_pago = method;
    updatePayload.saldo_cobrar = paid === "si" ? 0 : buildTotalAmountToCharge(pricing);
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
  getSimplePackageBranchPrices,
  upsertSimplePackageBranchPrice,
  updateSimplePackageByID,
  deleteSimplePackageByID,
  markSellerAccountingSimplePackagesDeposited,
};
