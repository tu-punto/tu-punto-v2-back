import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../helpers/jwt";
import { UserModel } from "../entities/implements/UserSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { ALL_APP_ROLES, normalizeUserRole, roleSatisfies } from "../constants/roles";
import {
  resolveSellerByUserId,
  sellerHasSystemAccess,
  SELLER_SYSTEM_ACCESS_DENIED_MESSAGE,
} from "../helpers/sellerAccess";

type AuthPayload = {
  id?: string;
  role?: string;
  sucursalId?: string;
  exp?: number;
  iat?: number;
};

const isSecure = process.env.NODE_ENV === "production";

const getTokenFromRequest = (req: Request): string | null => {
  const cookieToken = req.cookies?.token;
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, msg: "No autenticado" });
    }

    const decoded = verifyToken(token) as AuthPayload | null;
    if (!decoded?.id || !decoded?.role) {
      return res.status(401).json({ success: false, msg: "Token invalido o expirado" });
    }

    const role = normalizeUserRole(decoded.role);
    if (!role) {
      return res.status(401).json({ success: false, msg: "Token invalido o expirado" });
    }

    const authData: Record<string, unknown> = {
      id: decoded.id,
      role,
      sucursalId: decoded.sucursalId,
    };

    if (role === "seller") {
      const seller = await resolveSellerByUserId(decoded.id);
      if (seller?._id) {
        authData.sellerId = String(seller._id);
      }

      if (seller && !sellerHasSystemAccess(seller.fecha_vigencia)) {
        res.clearCookie("token", {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "strict" : "lax",
          path: "/",
        });
        return res.status(403).json({
          success: false,
          msg: SELLER_SYSTEM_ACCESS_DENIED_MESSAGE,
        });
      }
    }

    res.locals.auth = authData;
    next();
  } catch (error) {
    console.error("Error validando autenticacion:", error);
    return res.status(500).json({ success: false, msg: "Error validando la sesion" });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    const currentRole = String(res.locals.auth?.role || "").toLowerCase();
    if (!currentRole) {
      return res.status(401).json({ success: false, msg: "No autenticado" });
    }

    if (!roleSatisfies(currentRole, allowedRoles)) {
      return res.status(403).json({ success: false, msg: "No autorizado para este recurso" });
    }

    next();
  };
};

const resolveSellerIdForAuthenticatedUser = async (userId: string): Promise<string | null> => {
  const user = await UserModel.findById(userId).select("role vendedor email").lean();
  if (!user || String(user.role).toLowerCase() !== "seller") {
    return null;
  }

  if (user.vendedor) {
    return String(user.vendedor);
  }

  if (user.email) {
    const seller = await VendedorModel.findOne({ mail: user.email }).select("_id").lean();
    if (seller?._id) {
      return String(seller._id);
    }
  }

  return null;
};

const sanitizeId = (value: unknown): string => String(value || "").trim();

export const requireSellerOwnership = (paramName = "id") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as { id?: string; role?: string; sellerId?: string } | undefined;
    const role = String(auth?.role || "").toLowerCase();

    if (!role || !ALL_APP_ROLES.includes(role)) {
      return res.status(401).json({ success: false, msg: "No autenticado" });
    }

    if (role !== "seller") {
      return next();
    }

    const targetSellerId = sanitizeId(req.params?.[paramName]);
    if (!targetSellerId) {
      return res
        .status(400)
        .json({ success: false, msg: "No se pudo identificar el vendedor objetivo" });
    }

    let authenticatedSellerId = sanitizeId(auth?.sellerId);
    if (!authenticatedSellerId && auth?.id) {
      authenticatedSellerId = sanitizeId(await resolveSellerIdForAuthenticatedUser(auth.id));
      res.locals.auth = {
        ...res.locals.auth,
        sellerId: authenticatedSellerId,
      };
    }

    if (!authenticatedSellerId) {
      return res.status(403).json({ success: false, msg: "No autorizado para este vendedor" });
    }

    if (authenticatedSellerId !== targetSellerId) {
      return res.status(403).json({ success: false, msg: "No autorizado para este vendedor" });
    }

    next();
  };
};
