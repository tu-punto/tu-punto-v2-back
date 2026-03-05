import moment from "moment-timezone";
import { ExternalPaidStatus, IVentaExterna } from "../entities/IVentaExterna";
import { ExternalSaleRepository } from "../repositories/external.repository";

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

const getExternalSaleByID = async (id: string) => {
  return await ExternalSaleRepository.getExternalSaleByID(id);
};

const toTrimmed = (value: unknown): string => String(value ?? "").trim();

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const normalizeOrderStatus = (value: unknown, delivered: boolean): string => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return delivered ? "Entregado" : "En Espera";
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
    const paidTotal = montoPagaVendedor + montoPagaComprador;
    if (paidTotal <= 0) {
      montoPagaVendedor = 0;
      montoPagaComprador = packagePrice;
    } else if (paidTotal < packagePrice) {
      montoPagaComprador += packagePrice - paidTotal;
    }
    return {
      montoPagaVendedor: +montoPagaVendedor.toFixed(2),
      montoPagaComprador: +montoPagaComprador.toFixed(2),
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

const buildExternalRecord = (input: any, index = 0): IVentaExterna => {
  validateBuyerIdentity(input);

  const paid = normalizePaidStatus(input.esta_pagado);
  const packagePrice = toNumber(input.precio_paquete ?? input.precio_total, 0);
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

  return {
    carnet_vendedor: toTrimmed(input.carnet_vendedor ?? input.carnet ?? "SN"),
    vendedor: toTrimmed(input.vendedor ?? input.nombre_vendedor ?? "Externo"),
    telefono_vendedor: toTrimmed(input.telefono_vendedor) || undefined,
    numero_paquete: toNumber(input.numero_paquete, index + 1),
    comprador: buyerName || undefined,
    descripcion_paquete: toTrimmed(input.descripcion_paquete ?? input.descripcion ?? "Sin descripcion"),
    telefono_comprador: buyerPhone || undefined,
    fecha_pedido: normalizeExternalDate(input.fecha_pedido) as unknown as Date,
    sucursal: input.sucursal ?? input.id_sucursal,
    precio_paquete: packagePrice,
    precio_total: packagePrice,
    esta_pagado: paid,
    monto_paga_vendedor: montoPagaVendedor,
    monto_paga_comprador: montoPagaComprador,
    saldo_cobrar: saldoCobrar,
    estado_pedido: estadoPedido,
    delivered,
    is_external: true,
    hora_entrega_real: delivered
      ? (normalizeExternalDate(input.hora_entrega_real ?? input.fecha_pedido) as unknown as Date)
      : undefined,
    lugar_entrega: toTrimmed(input.lugar_entrega ?? "Externo"),
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

  const record = buildExternalRecord(externalSale);
  return await ExternalSaleRepository.registerExternalSale(record);
};

const registerExternalSalesByPackages = async (payload: any) => {
  const paquetes = Array.isArray(payload?.paquetes) ? payload.paquetes : [];
  if (!paquetes.length) throw new Error("Debe enviar al menos un paquete");

  const toCreate: IVentaExterna[] = paquetes.map((pkg: any, index: number) => {
    const merged = {
      ...payload,
      ...pkg,
      numero_paquete: pkg?.numero_paquete ?? index + 1,
      fecha_pedido: payload?.fecha_pedido,
      carnet_vendedor: payload?.carnet_vendedor,
      vendedor: payload?.vendedor,
      telefono_vendedor: payload?.telefono_vendedor,
    };

    if (merged.id_sucursal) {
      merged.sucursal = merged.id_sucursal;
    }

    return buildExternalRecord(merged, index);
  });

  return await ExternalSaleRepository.registerExternalSales(toCreate);
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
  const paid = normalizePaidStatus(externalSale.esta_pagado ?? existing.esta_pagado);
  const status = normalizeOrderStatus(
    externalSale.estado_pedido ?? existing.estado_pedido,
    externalSale.delivered === true || existing.delivered === true
  );
  const delivered = status === "Entregado";

  const { montoPagaVendedor, montoPagaComprador, saldoCobrar } = resolvePaymentSplit(
    paid,
    price,
    externalSale.monto_paga_vendedor ?? existing.monto_paga_vendedor,
    externalSale.monto_paga_comprador ?? existing.monto_paga_comprador
  );

  const updatePayload: any = {
    ...externalSale,
    comprador: buyerName || undefined,
    telefono_comprador: buyerPhone || undefined,
    precio_paquete: price,
    precio_total: price,
    esta_pagado: paid,
    monto_paga_vendedor: montoPagaVendedor,
    monto_paga_comprador: montoPagaComprador,
    saldo_cobrar: saldoCobrar,
    estado_pedido: status,
    delivered,
    is_external: true,
  };

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

  return await ExternalSaleRepository.updateExternalSaleByID(id, updatePayload);
};

export const ExternalSaleService = {
  getAllExternalSales,
  getExternalSalesList,
  getExternalSaleByID,
  registerExternalSale,
  registerExternalSalesByPackages,
  deleteExternalSaleByID,
  updateExternalSaleByID,
};
