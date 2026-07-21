import { Types } from "mongoose";

export class RequestValidationError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RequestValidationError";
    this.status = 400;
    this.details = details;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const TRACKING_CODE_REGEX = /^[A-Za-z0-9\-_]{3,80}$/;
const URL_REGEX = /^https?:\/\/[^\s]+$/i;

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const ensurePlainObject = (value: unknown, fieldName = "payload"): PlainObject => {
  if (!isPlainObject(value)) {
    throw new RequestValidationError(`${fieldName} invalido`);
  }

  return value;
};

export const rejectUnexpectedKeys = (value: PlainObject, allowedKeys: string[], fieldName = "payload") => {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new RequestValidationError(`${fieldName} contiene campos no permitidos`, {
      unexpected,
    });
  }
};

export const parseRequiredString = (
  value: unknown,
  fieldName: string,
  options?: { minLength?: number; maxLength?: number; pattern?: RegExp; patternMessage?: string }
) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new RequestValidationError(`${fieldName} es requerido`);
  }

  if (options?.minLength && normalized.length < options.minLength) {
    throw new RequestValidationError(`${fieldName} es demasiado corto`);
  }

  if (options?.maxLength && normalized.length > options.maxLength) {
    throw new RequestValidationError(`${fieldName} es demasiado largo`);
  }

  if (options?.pattern && !options.pattern.test(normalized)) {
    throw new RequestValidationError(options.patternMessage || `${fieldName} es invalido`);
  }

  return normalized;
};

export const parseOptionalString = (
  value: unknown,
  fieldName: string,
  options?: { maxLength?: number; pattern?: RegExp; patternMessage?: string }
) => {
  if (value === undefined || value === null || value === "") return undefined;
  return parseRequiredString(value, fieldName, {
    minLength: 1,
    maxLength: options?.maxLength,
    pattern: options?.pattern,
    patternMessage: options?.patternMessage,
  });
};

export const parseEmail = (value: unknown, fieldName = "email") =>
  parseRequiredString(value, fieldName, {
    maxLength: 160,
    pattern: EMAIL_REGEX,
    patternMessage: `${fieldName} es invalido`,
  }).toLowerCase();

export const parseObjectId = (value: unknown, fieldName: string) => {
  const normalized = parseRequiredString(value, fieldName, { maxLength: 64 });
  if (!Types.ObjectId.isValid(normalized)) {
    throw new RequestValidationError(`${fieldName} es invalido`);
  }
  return normalized;
};

export const parseOptionalObjectId = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  return parseObjectId(value, fieldName);
};

export const parseOptionalBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "si", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new RequestValidationError("Boolean invalido");
};

export const parseBooleanWithDefault = (value: unknown, fallback = false) => {
  const parsed = parseOptionalBoolean(value);
  return parsed === undefined ? fallback : parsed;
};

export const parseEnum = <T extends string>(value: unknown, fieldName: string, values: readonly T[]) => {
  const normalized = parseRequiredString(value, fieldName, { maxLength: 80 }).toLowerCase() as T;
  if (!values.includes(normalized)) {
    throw new RequestValidationError(`${fieldName} es invalido`);
  }
  return normalized;
};

export const parseOptionalEnum = <T extends string>(
  value: unknown,
  fieldName: string,
  values: readonly T[]
) => {
  if (value === undefined || value === null || value === "") return undefined;
  return parseEnum(value, fieldName, values);
};

export const parseMonth = (value: unknown, fieldName: string) =>
  parseRequiredString(value, fieldName, {
    maxLength: 7,
    pattern: MONTH_REGEX,
    patternMessage: `${fieldName} debe tener formato YYYY-MM`,
  });

export const parseOptionalMonth = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  return parseMonth(value, fieldName);
};

export const parseStringArray = (
  value: unknown,
  fieldName: string,
  options?: { allowCsv?: boolean; maxItems?: number; itemMaxLength?: number }
) => {
  const raw = Array.isArray(value)
    ? value
    : options?.allowCsv !== false && typeof value === "string"
      ? value.split(",")
      : undefined;

  if (!raw) return undefined;

  const items = raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  if (options?.maxItems && items.length > options.maxItems) {
    throw new RequestValidationError(`${fieldName} tiene demasiados elementos`);
  }

  const itemMaxLength = options?.itemMaxLength;
  if (itemMaxLength !== undefined && items.some((item) => item.length > itemMaxLength)) {
    throw new RequestValidationError(`${fieldName} contiene valores demasiado largos`);
  }

  return items;
};

export const parseObjectIdArray = (value: unknown, fieldName: string, options?: { maxItems?: number }) => {
  const items = parseStringArray(value, fieldName, { allowCsv: true, maxItems: options?.maxItems, itemMaxLength: 64 });
  if (!items) return undefined;

  items.forEach((item) => {
    if (!Types.ObjectId.isValid(item)) {
      throw new RequestValidationError(`${fieldName} contiene IDs invalidos`);
    }
  });

  return items;
};

export const parseMonthArray = (value: unknown, fieldName: string, options?: { maxItems?: number }) => {
  const items = parseStringArray(value, fieldName, { allowCsv: true, maxItems: options?.maxItems, itemMaxLength: 7 });
  if (!items) return undefined;
  items.forEach((item) => {
    if (!MONTH_REGEX.test(item)) {
      throw new RequestValidationError(`${fieldName} debe contener meses con formato YYYY-MM`);
    }
  });
  return items;
};

export const parseOptionalInteger = (
  value: unknown,
  fieldName: string,
  options?: { min?: number; max?: number }
) => {
  if (value === undefined || value === null || value === "") return undefined;

  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw new RequestValidationError(`${fieldName} debe ser un entero`);
  }

  if (options?.min !== undefined && num < options.min) {
    throw new RequestValidationError(`${fieldName} es demasiado pequeno`);
  }

  if (options?.max !== undefined && num > options.max) {
    throw new RequestValidationError(`${fieldName} es demasiado grande`);
  }

  return num;
};

export const parseOptionalNumber = (
  value: unknown,
  fieldName: string,
  options?: { min?: number; max?: number }
) => {
  if (value === undefined || value === null || value === "") return undefined;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new RequestValidationError(`${fieldName} debe ser numerico`);
  }

  if (options?.min !== undefined && num < options.min) {
    throw new RequestValidationError(`${fieldName} es demasiado pequeno`);
  }

  if (options?.max !== undefined && num > options.max) {
    throw new RequestValidationError(`${fieldName} es demasiado grande`);
  }

  return num;
};

export const parseTrackingCode = (value: unknown, fieldName = "code") =>
  parseRequiredString(value, fieldName, {
    minLength: 3,
    maxLength: 80,
    pattern: TRACKING_CODE_REGEX,
    patternMessage: `${fieldName} es invalido`,
  });

export const parseOptionalUrl = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  return parseRequiredString(value, fieldName, {
    maxLength: 2048,
    pattern: URL_REGEX,
    patternMessage: `${fieldName} es invalido`,
  });
};

export const parsePushSubscription = (value: unknown) => {
  const payload = ensurePlainObject(value, "subscription");
  rejectUnexpectedKeys(payload, ["endpoint", "keys"], "subscription");

  const keys = ensurePlainObject(payload.keys, "subscription.keys");
  rejectUnexpectedKeys(keys, ["p256dh", "auth"], "subscription.keys");

  return {
    endpoint: parseRequiredString(payload.endpoint, "subscription.endpoint", { maxLength: 2048 }),
    keys: {
      p256dh: parseRequiredString(keys.p256dh, "subscription.keys.p256dh", { maxLength: 1024 }),
      auth: parseRequiredString(keys.auth, "subscription.keys.auth", { maxLength: 512 }),
    },
  };
};

type AccessWindow = {
  enabled?: boolean;
  start?: string;
  end?: string;
};

export const parseAccessWindow = (value: unknown, fieldName: string): AccessWindow | undefined => {
  if (value === undefined || value === null) return undefined;
  const payload = ensurePlainObject(value, fieldName);
  rejectUnexpectedKeys(payload, ["enabled", "start", "end"], fieldName);

  const enabled = parseBooleanWithDefault(payload.enabled, false);
  const start = parseOptionalString(payload.start, `${fieldName}.start`, {
    maxLength: 5,
    pattern: TIME_REGEX,
    patternMessage: `${fieldName}.start es invalido`,
  });
  const end = parseOptionalString(payload.end, `${fieldName}.end`, {
    maxLength: 5,
    pattern: TIME_REGEX,
    patternMessage: `${fieldName}.end es invalido`,
  });

  if (enabled && (!start || !end)) {
    throw new RequestValidationError(`${fieldName} requiere hora de inicio y fin`);
  }

  return {
    enabled,
    start: start || "00:00",
    end: end || "00:00",
  };
};

export const parseAccessHours = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const payload = ensurePlainObject(value, "system_access_hours");
  rejectUnexpectedKeys(payload, ["weekdays", "saturday", "sunday"], "system_access_hours");

  return {
    weekdays: parseAccessWindow(payload.weekdays, "system_access_hours.weekdays"),
    saturday: parseAccessWindow(payload.saturday, "system_access_hours.saturday"),
    sunday: parseAccessWindow(payload.sunday, "system_access_hours.sunday"),
  };
};

export const parseOptionalStringArrayObject = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;

  const payload = ensurePlainObject(value, fieldName);
  const result: Record<string, string[]> = {};

  for (const [key, rawValue] of Object.entries(payload)) {
    result[key] = parseStringArray(rawValue, `${fieldName}.${key}`, {
      allowCsv: false,
      maxItems: 50,
      itemMaxLength: 120,
    }) || [];
  }

  return result;
};

export const parseOptionalJson = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    throw new RequestValidationError(`${fieldName} no tiene JSON valido`);
  }
};
