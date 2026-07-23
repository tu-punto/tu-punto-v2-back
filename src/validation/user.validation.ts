import { Response } from "express";
import {
  ensurePlainObject,
  parseAccessHours,
  parseEmail,
  parseEnum,
  parseObjectId,
  parseOptionalObjectId,
  parseRequiredString,
  rejectUnexpectedKeys,
  RequestValidationError,
} from "./requestValidation";

const USER_ROLES = ["admin", "operator", "seller"] as const;

const parsePasswordPair = (payload: Record<string, unknown>, required = true) => {
  const password = required
    ? parseRequiredString(payload.password, "password", { minLength: 6, maxLength: 160 })
    : payload.password === undefined || payload.password === null || payload.password === ""
      ? undefined
      : parseRequiredString(payload.password, "password", { minLength: 6, maxLength: 160 });

  const confirmPassword =
    payload.confirmPassword === undefined || payload.confirmPassword === null || payload.confirmPassword === ""
      ? undefined
      : parseRequiredString(payload.confirmPassword, "confirmPassword", { minLength: 6, maxLength: 160 });

  if (required && !confirmPassword) {
    throw new RequestValidationError("confirmPassword es requerido");
  }

  if (password !== undefined && confirmPassword !== undefined && password !== confirmPassword) {
    throw new RequestValidationError("Las contrasenas no coinciden");
  }

  return password;
};

const parseOperatorFields = (payload: Record<string, unknown>) => {
  const sucursal = parseObjectId(payload.sucursal ?? payload.sucursalId, "sucursal");
  const systemAccessHours = parseAccessHours(payload.system_access_hours);

  return {
    sucursal,
    system_access_hours: systemAccessHours,
  };
};

export const validateLoginBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["email", "password", "sucursalId"], "body");

  return {
    email: parseEmail(payload.email),
    password: parseRequiredString(payload.password, "password", { minLength: 1, maxLength: 160 }),
    ...(payload.sucursalId ? { sucursalId: parseObjectId(payload.sucursalId, "sucursalId") } : {}),
  };
};

export const validateRegisterUserBody = (input: unknown, _res?: Response) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["email", "role", "password", "confirmPassword", "sucursal", "sucursalId", "system_access_hours"], "body");

  const role = parseEnum(payload.role, "role", USER_ROLES);
  const password = parsePasswordPair(payload, true);

  if (role === "operator") {
    return {
      email: parseEmail(payload.email),
      role,
      password,
      ...parseOperatorFields(payload),
    };
  }

  return {
    email: parseEmail(payload.email),
    role,
    password,
  };
};

export const validateUpdateUserParams = (input: unknown) => {
  const payload = ensurePlainObject(input, "params");
  rejectUnexpectedKeys(payload, ["id"], "params");

  return {
    id: parseObjectId(payload.id, "id"),
  };
};

export const validateUpdateUserBody = (input: unknown, res?: Response) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["email", "role", "password", "confirmPassword", "sucursal", "sucursalId", "system_access_hours"], "body");

  const authRole = String(res?.locals.auth?.role || "").toLowerCase();
  const role = parseEnum(payload.role, "role", USER_ROLES);
  const password = parsePasswordPair(payload, false);
  const email = parseEmail(payload.email);

  if (authRole !== "superadmin" && payload.system_access_hours !== undefined) {
    throw new RequestValidationError("Solo superadmin puede definir horarios de acceso");
  }

  if (role === "operator") {
    return {
      email,
      role,
      ...(password ? { password } : {}),
      ...parseOperatorFields(payload),
    };
  }

  return {
    email,
    role,
    ...(password ? { password } : {}),
    sucursal: null,
  };
};

export const validateChangePasswordBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["currentPassword", "newPassword", "confirmPassword"], "body");

  const currentPassword = parseRequiredString(payload.currentPassword, "currentPassword", {
    minLength: 1,
    maxLength: 160,
  });
  const newPassword = parseRequiredString(payload.newPassword, "newPassword", {
    minLength: 6,
    maxLength: 160,
  });
  const confirmPassword = parseRequiredString(payload.confirmPassword, "confirmPassword", {
    minLength: 6,
    maxLength: 160,
  });

  if (newPassword !== confirmPassword) {
    throw new RequestValidationError("Las contrasenas no coinciden");
  }

  return {
    currentPassword,
    newPassword,
    confirmPassword,
  };
};

export const validateResetSellerPasswordParams = (input: unknown) => {
  const payload = ensurePlainObject(input, "params");
  rejectUnexpectedKeys(payload, ["sellerId"], "params");

  return {
    sellerId: parseObjectId(payload.sellerId, "sellerId"),
  };
};

export const validateResetSellerPasswordBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["newPassword"], "body");

  return {
    newPassword: parseRequiredString(payload.newPassword, "newPassword", {
      minLength: 6,
      maxLength: 160,
    }),
  };
};

export const validateResetUserPasswordParams = (input: unknown) => {
  const payload = ensurePlainObject(input, "params");
  rejectUnexpectedKeys(payload, ["id"], "params");

  return {
    id: parseObjectId(payload.id, "id"),
  };
};
