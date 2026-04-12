import moment from "moment-timezone";
import { Types } from "mongoose";
import { IVentaExterna, PackagePaymentMethod, PackageSize } from "../entities/IVentaExterna";
import { SellerRepository } from "../repositories/seller.repository";
import { SimplePackageBranchPriceRepository } from "../repositories/simplePackageBranchPrice.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";
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

const resolveBranchRoutePricing = async (originBranchId?: string, destinationBranchId?: string) => {
  if (!originBranchId || !destinationBranchId) {
    return {
      precio_entre_sucursal: 0,
      originBranchName: "",
      destinationBranchName: "",
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
  const deudaComprador = roundCurrency(Math.max(0, precioPaquete - deudaVendedor));
  const precioEntreSucursal = roundCurrency(branchRoutePrice);
  const precioTotal = roundCurrency(precioPaquete + precioEntreSucursal);

  return {
    precio_paquete_unitario: precioPaqueteUnitario,
    amortizacion_vendedor: deudaVendedor,
    saldo_por_paquete: roundCurrency(saldoPorPaquete),
    precio_paquete: precioPaquete,
    precio_entre_sucursal: precioEntreSucursal,
    precio_total: precioTotal,
    deuda_comprador: deudaComprador,
    monto_paga_vendedor: deudaVendedor,
    monto_paga_comprador: deudaComprador,
  };
};

const buildSimplePackageRecord = async (params: {
  row: any;
  index: number;
  packageNumber: number;
  seller: any;
  sellerId: string;
  originBranchId?: string;
}) => {
  const { row, index, packageNumber, seller, sellerId, originBranchId } = params;
  ensureBuyerIdentity(row);
  ensureDescription(row);

  const packageSize = normalizePackageSize(row?.package_size ?? row?.tamano);
  const destinationBranchId = toTrimmed(row?.destino_sucursal_id ?? row?.destino_sucursal);
  if (!destinationBranchId) {
    throw new Error(`Paquete ${index + 1}: debe seleccionar una sucursal destino`);
  }

  const branchRoutePricing = await resolveBranchRoutePricing(originBranchId, destinationBranchId);
  const pricing = buildPackagePricing(
    toNumber(seller?.precio_paquete ?? 0),
    toNumber(seller?.amortizacion ?? 0),
    toNumber(seller?.saldo_por_paquete ?? 0),
    packageSize,
    branchRoutePricing.precio_entre_sucursal
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
    saldo_cobrar: paid === "si" ? 0 : pricing.deuda_comprador,
    estado_pedido: "En Espera",
    delivered: false,
    is_external: false,
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
}) => {
  const { sellerId, paquetes, originBranchId } = params;
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
      })
    )
  );

  const created = await SimplePackageRepository.registerSimplePackages(rows);
  const saldoDelta = roundCurrency(
    rows.reduce((acc, row) => acc + Number(row?.saldo_por_paquete || 0), 0)
  );
  await adjustSellerSaldoPendiente(sellerId, saldoDelta);
  return created;
};

const getSimplePackagesList = async (params: {
  sellerId: string;
  from?: Date;
  to?: Date;
}) => {
  return await SimplePackageRepository.getSimplePackagesList(params);
};

const getUploadedSimplePackageSellers = async () => {
  return await SimplePackageRepository.getUploadedSimplePackageSellers();
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
  const branchRoutePricing = await resolveBranchRoutePricing(nextOriginBranchId, nextDestinationBranchId);
  const pricing = buildPackagePricing(
    toNumber(existing.precio_paquete_unitario, 0),
    toNumber(existing.amortizacion_vendedor, 0),
    toNumber(existing.saldo_por_paquete, 0),
    nextPackageSize,
    branchRoutePricing.precio_entre_sucursal
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
  }

  if (isPrivileged) {
    const paid = normalizePaidStatus(params.payload?.esta_pagado ?? existing.esta_pagado);
    const method = paid === "si" ? normalizePaymentMethod(params.payload?.metodo_pago ?? existing.metodo_pago) : "";
    updatePayload.esta_pagado = paid;
    updatePayload.metodo_pago = method;
    updatePayload.saldo_cobrar = paid === "si" ? 0 : pricing.deuda_comprador;
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
    await adjustSellerSaldoPendiente(existingSellerId, -roundCurrency(Number(existing.saldo_por_paquete || 0)));
  }
  return deleted;
};

export const SimplePackageService = {
  registerSimplePackages,
  getSimplePackagesList,
  getUploadedSimplePackageSellers,
  getSimplePackageBranchPrices,
  upsertSimplePackageBranchPrice,
  updateSimplePackageByID,
  deleteSimplePackageByID,
};
