import { Response } from "express";

type TraceAuthLike = {
  id?: string;
  role?: string;
  email?: string;
  sellerId?: string;
};

export const buildActionTraceActor = (auth?: TraceAuthLike) => ({
  userId: String(auth?.id || "").trim() || undefined,
  role: String(auth?.role || "").trim() || undefined,
  name: String(auth?.email || "").trim() || undefined,
  sellerId: String(auth?.sellerId || "").trim() || undefined,
});

export const getActionTraceActorFromResponse = (res: Response) =>
  buildActionTraceActor(res.locals.auth as TraceAuthLike | undefined);

export const getErrorMessage = (error: unknown, fallback = "Error desconocido") => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
};

export const getErrorStatus = (error: unknown): number | undefined => {
  const candidate = error as any;
  const status = Number(candidate?.status || candidate?.response?.status || candidate?.statusCode);
  return Number.isFinite(status) && status > 0 ? status : undefined;
};

export const classifyActionFailure = (error: unknown) => {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error, "No se pudo completar la accion").toLowerCase();

  if (status === 400) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status && status >= 500) return "server_error";

  if (message.includes("stock suficiente") || message.includes("no hay stock")) return "business_rule";
  if (message.includes("no encontrado") || message.includes("not found")) return "not_found";
  if (message.includes("autoriz")) return "forbidden";
  if (message.includes("valid")) return "validation";

  return "unknown";
};

export const safeString = (value: unknown) => String(value ?? "").trim();
