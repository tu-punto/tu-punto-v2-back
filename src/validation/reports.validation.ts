import {
  ensurePlainObject,
  parseMonthArray,
  parseObjectIdArray,
  parseOptionalInteger,
  parseOptionalMonth,
  parseOptionalNumber,
  parseOptionalObjectId,
  parseOptionalString,
  parseOptionalStringArrayObject,
  parseStringArray,
  rejectUnexpectedKeys,
  RequestValidationError,
} from "./requestValidation";

const MODO_TOP = ["clientes", "vendedores"] as const;
const TICKET_PROMEDIO = ["pago_fijo", "comision", "pago_fijo_mas_comision"] as const;

const parseModoTop = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!MODO_TOP.includes(normalized as (typeof MODO_TOP)[number])) {
    throw new RequestValidationError("modoTop es invalido");
  }
  return normalized as (typeof MODO_TOP)[number];
};

const parseTicketPromedioModo = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!TICKET_PROMEDIO.includes(normalized as (typeof TICKET_PROMEDIO)[number])) {
    throw new RequestValidationError("ticketPromedioModo es invalido");
  }
  return normalized as (typeof TICKET_PROMEDIO)[number];
};

const parseOperacionBase = (payload: Record<string, unknown>) => ({
  ...(payload.mes ? { mes: parseOptionalMonth(payload.mes, "mes") } : {}),
  ...(payload.meses ? { meses: parseMonthArray(payload.meses, "meses", { maxItems: 12 }) } : {}),
  ...(payload.sucursales ? { sucursales: parseObjectIdArray(payload.sucursales, "sucursales", { maxItems: 50 }) } : {}),
  ...(payload.modoTop ? { modoTop: parseModoTop(payload.modoTop) } : {}),
  ...(payload.ticketPromedioModo ? { ticketPromedioModo: parseTicketPromedioModo(payload.ticketPromedioModo) } : {}),
  ...(payload.reportes ? { reportes: parseStringArray(payload.reportes, "reportes", { allowCsv: true, maxItems: 30, itemMaxLength: 120 }) } : {}),
  ...(payload.columnas ? { columnas: parseOptionalStringArrayObject(payload.columnas, "columnas") } : {}),
});

export const validateOperacionMensualBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["mes", "meses", "sucursales", "modoTop", "ticketPromedioModo", "reportes", "columnas"], "body");
  return parseOperacionBase(payload);
};

export const validateOperacionMensualQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["mes", "meses", "sucursales", "modoTop", "ticketPromedioModo", "reportes", "columnas"], "query");
  const columnas = typeof payload.columnas === "string" ? JSON.parse(String(payload.columnas)) : payload.columnas;
  return parseOperacionBase({ ...payload, columnas });
};

export const validateInventarioActualBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["idSucursal", "sellerId"], "body");
  return {
    idSucursal: parseOptionalObjectId(payload.idSucursal, "idSucursal") || (() => { throw new RequestValidationError("idSucursal es requerido"); })(),
    ...(payload.sellerId ? { sellerId: parseOptionalObjectId(payload.sellerId, "sellerId") } : {}),
  };
};

export const validateInventarioActualQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["idSucursal", "sellerId"], "query");
  return {
    idSucursal: parseOptionalObjectId(payload.idSucursal, "idSucursal") || (() => { throw new RequestValidationError("idSucursal es requerido"); })(),
    ...(payload.sellerId ? { sellerId: parseOptionalObjectId(payload.sellerId, "sellerId") } : {}),
  };
};

const parseMesesSucursalBody = (input: unknown, fieldName = "body") => {
  const payload = ensurePlainObject(input, fieldName);
  rejectUnexpectedKeys(payload, ["mes", "meses", "mesFin", "sucursales", "incluirDeuda"], fieldName);
  return {
    ...(payload.mes ? { mes: parseOptionalMonth(payload.mes, "mes") } : {}),
    ...(payload.meses ? { meses: parseMonthArray(payload.meses, "meses", { maxItems: 12 }) } : {}),
    ...(payload.mesFin ? { mesFin: parseOptionalMonth(payload.mesFin, "mesFin") } : {}),
    ...(payload.sucursales ? { sucursales: parseObjectIdArray(payload.sucursales, "sucursales", { maxItems: 50 }) } : {}),
    ...(payload.incluirDeuda !== undefined ? { incluirDeuda: Boolean(payload.incluirDeuda === true || String(payload.incluirDeuda).toLowerCase() === "true") } : {}),
  };
};

export const validateMesesBody = (input: unknown) => parseMesesSucursalBody(input, "body");

export const validateMesesQuery = (input: unknown) => parseMesesSucursalBody(input, "query");

export const validateStockProductosQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["idSucursal"], "query");
  return {
    idSucursal: parseOptionalObjectId(payload.idSucursal, "idSucursal") || (() => { throw new RequestValidationError("idSucursal es requerido"); })(),
  };
};

export const validateVentasQrBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["mes", "meses", "sucursales"], "body");
  return {
    ...(payload.mes ? { mes: parseOptionalMonth(payload.mes, "mes") } : {}),
    ...(payload.meses ? { meses: parseMonthArray(payload.meses, "meses", { maxItems: 12 }) } : {}),
    ...(payload.sucursales ? { sucursales: parseObjectIdArray(payload.sucursales, "sucursales", { maxItems: 50 }) } : {}),
  };
};

export const validateVentasQrQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["meses", "sucursales"], "query");
  return {
    ...(payload.meses ? { meses: parseMonthArray(payload.meses, "meses", { maxItems: 12 }) } : {}),
    ...(payload.sucursales ? { sucursales: parseObjectIdArray(payload.sucursales, "sucursales", { maxItems: 50 }) } : {}),
  };
};

export const validateEntregasSimplesQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["sellerId", "sellerIds", "meses"], "query");
  return {
    ...(payload.sellerId ? { sellerId: parseOptionalObjectId(payload.sellerId, "sellerId") } : {}),
    ...(payload.sellerIds ? { sellerIds: parseObjectIdArray(payload.sellerIds, "sellerIds", { maxItems: 100 }) } : {}),
    ...(payload.meses ? { meses: parseMonthArray(payload.meses, "meses", { maxItems: 12 }) } : {}),
  };
};

export const validateReporteEntregasExternasQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["mes", "meses", "sucursales"], "query");
  return {
    ...(payload.mes ? { mes: parseOptionalMonth(payload.mes, "mes") } : {}),
    ...(payload.meses ? { meses: parseMonthArray(payload.meses, "meses", { maxItems: 12 }) } : {}),
    ...(payload.sucursales ? { sucursales: parseObjectIdArray(payload.sucursales, "sucursales", { maxItems: 50 }) } : {}),
  };
};

export const validateVentasTemporalesQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["sellerId"], "query");
  return {
    sellerId: parseOptionalObjectId(payload.sellerId, "sellerId") || (() => { throw new RequestValidationError("sellerId es requerido"); })(),
  };
};

export const validateProductosRiesgoQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["sellerId", "limit", "minCombinaciones", "minEspacioTeorico"], "query");
  return {
    ...(payload.sellerId ? { sellerId: parseOptionalObjectId(payload.sellerId, "sellerId") } : {}),
    ...(payload.limit !== undefined ? { limit: parseOptionalInteger(payload.limit, "limit", { min: 1, max: 5000 }) } : {}),
    ...(payload.minCombinaciones !== undefined
      ? { minCombinaciones: parseOptionalNumber(payload.minCombinaciones, "minCombinaciones", { min: 0 }) }
      : {}),
    ...(payload.minEspacioTeorico !== undefined
      ? { minEspacioTeorico: parseOptionalNumber(payload.minEspacioTeorico, "minEspacioTeorico", { min: 0 }) }
      : {}),
  };
};
