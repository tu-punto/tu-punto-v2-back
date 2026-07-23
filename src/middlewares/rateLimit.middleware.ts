import { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  message: string;
  includeUserId?: boolean;
};

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

const getClientIp = (req: Request) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }

  return req.ip || req.socket.remoteAddress || "unknown";
};

const cleanupExpiredEntries = (now: number) => {
  if (store.size < 500) return;

  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
};

export const createRateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const userId = options.includeUserId ? String(res.locals.auth?.id || "").trim() : "";
    const key = [options.keyPrefix, getClientIp(req), userId].filter(Boolean).join(":");
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    current.count += 1;
    if (current.count > options.maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfter);
      console.warn("[rate-limit] bloqueado", {
        keyPrefix: options.keyPrefix,
        ip: getClientIp(req),
        userId: userId || undefined,
        path: req.originalUrl,
        method: req.method,
        count: current.count,
      });
      return res.status(429).json({
        success: false,
        message: options.message,
      });
    }

    return next();
  };
};

export const rateLimiters = {
  login: createRateLimit({
    keyPrefix: "login",
    windowMs: 15 * 60 * 1000,
    maxRequests: 8,
    message: "Demasiados intentos de inicio de sesion. Intenta nuevamente en unos minutos.",
  }),
  publicTracking: createRateLimit({
    keyPrefix: "tracking-public",
    windowMs: 5 * 60 * 1000,
    maxRequests: 60,
    message: "Demasiadas consultas de tracking. Intenta nuevamente en unos minutos.",
  }),
  buyerPushSubscription: createRateLimit({
    keyPrefix: "tracking-push-subscription",
    windowMs: 10 * 60 * 1000,
    maxRequests: 10,
    message: "Demasiados intentos de suscripcion. Intenta nuevamente mas tarde.",
  }),
  reports: createRateLimit({
    keyPrefix: "reports",
    windowMs: 5 * 60 * 1000,
    maxRequests: 20,
    message: "Demasiadas solicitudes de reportes. Intenta nuevamente en unos minutos.",
    includeUserId: true,
  }),
  uploads: createRateLimit({
    keyPrefix: "uploads",
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    message: "Demasiados uploads en poco tiempo. Intenta nuevamente mas tarde.",
    includeUserId: true,
  }),
  publicReports: createRateLimit({
    keyPrefix: "public-reports",
    windowMs: 10 * 60 * 1000,
    maxRequests: 8,
    message: "Demasiadas descargas en poco tiempo. Intenta nuevamente mas tarde.",
  }),
};
