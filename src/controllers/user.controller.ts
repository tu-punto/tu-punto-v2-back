import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import moment from "moment-timezone";
import { CategoryService } from "../services/category.service";
import { assertPasswordStrength, comparePassword, hashPassword } from "../helpers/auth";
import { UserService } from "../services/user.service";
import { generateToken } from "../helpers/jwt";
import { getJwtSecret } from "../config/secrets";
import { VendedorModel } from "../entities/implements/VendedorSchema"; 
import { TrabajadorModel } from "../entities/implements/TrabajadorSchema";
import { UserModel } from "../entities/implements/UserSchema";
import { Types } from "mongoose";
import {
  ASSIGNABLE_USER_ROLES,
  getPublicUserRole,
  isSuperadminRole,
  normalizeUserRole,
} from "../constants/roles";
import { canAccessSellerProductInfoByCommission } from "../utils";
import {
  resolveSellerByUserData,
  sellerHasSystemAccess,
  SELLER_SYSTEM_ACCESS_DENIED_MESSAGE,
} from "../helpers/sellerAccess";
import {
  hasCommissionServiceEnabled,
  hasSimplePackageServiceEnabled,
  hasConfiguredCommissionService,
  hasConfiguredSimplePackageService,
} from "../utils/seller.utils";

dotenv.config();

const JWT_SECRET = getJwtSecret();
const isSecure = process.env.NODE_ENV === "production";
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);
const ACCESS_TIMEZONE = "America/La_Paz";

type AccessWindow = {
  enabled?: boolean;
  start?: string;
  end?: string;
};

type AccessHours = {
  weekdays?: AccessWindow;
  saturday?: AccessWindow;
  sunday?: AccessWindow;
};

const clearAuthCookie = (res: Response) =>
  res.clearCookie("token", {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
  });

type SellerProductInfoAccessShape = {
  pago_sucursales?: {
    alquiler?: number;
    exhibicion?: number;
    delivery?: number;
    entrega_simple?: number;
    activo?: boolean;
  }[];
  comision_porcentual?: number;
  comision_fija?: number;
  amortizacion?: number | null;
  precio_paquete?: number | null;
  fecha_vigencia?: unknown;
};

const serializeUserForClient = (user: any) => {
  const userObj = user?.toObject?.() || { ...(user || {}) };
  delete userObj.password;
  delete userObj.failed_login_attempts;
  delete userObj.login_locked_until;

  const actualRole = normalizeUserRole(userObj.role);

  return {
    ...userObj,
    role: getPublicUserRole(actualRole),
    is_superadmin: actualRole === "superadmin",
    must_change_password: userObj.must_change_password === true,
  };
};

const resolveUserBranchForRole = (role: string, branchValue: unknown) => {
  if (role !== "operator") return null;

  const branchId =
    typeof branchValue === "object" && branchValue
      ? String((branchValue as any)._id || branchValue || "")
      : String(branchValue || "");

  if (!Types.ObjectId.isValid(branchId)) {
    throw new Error("Debe asignar una sucursal valida al operador");
  }

  return new Types.ObjectId(branchId);
};

const resolveIdString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    return String((value as any)._id || (value as any).$oid || value || "");
  }
  return String(value);
};

const normalizeTimeString = (value: unknown): string => String(value || "").trim();

const normalizeAccessWindow = (window?: AccessWindow | null): AccessWindow | undefined => {
  if (!window) return undefined;

  return {
    enabled: window.enabled === true,
    start: normalizeTimeString(window.start),
    end: normalizeTimeString(window.end),
  };
};

const normalizeAccessHours = (hours?: AccessHours | null): AccessHours | undefined => {
  if (!hours) return undefined;

  const normalized = {
    weekdays: normalizeAccessWindow(hours.weekdays),
    saturday: normalizeAccessWindow(hours.saturday),
    sunday: normalizeAccessWindow(hours.sunday),
  };

  if (!normalized.weekdays && !normalized.saturday && !normalized.sunday) {
    return undefined;
  }

  return normalized;
};

const isValidTimeString = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isNowWithinWindow = (window?: AccessWindow | null): boolean => {
  if (!window?.enabled) return false;

  const start = normalizeTimeString(window.start);
  const end = normalizeTimeString(window.end);
  if (!isValidTimeString(start) || !isValidTimeString(end)) return false;

  const now = moment().tz(ACCESS_TIMEZONE);
  const startMoment = moment.tz(`${now.format("YYYY-MM-DD")} ${start}`, "YYYY-MM-DD HH:mm", ACCESS_TIMEZONE);
  const endMoment = moment.tz(`${now.format("YYYY-MM-DD")} ${end}`, "YYYY-MM-DD HH:mm", ACCESS_TIMEZONE);

  return now.isSameOrAfter(startMoment) && now.isSameOrBefore(endMoment);
};

const canOperatorLogin = (hours?: AccessHours | null): boolean => {
  if (!hours) return true;

  const day = moment().tz(ACCESS_TIMEZONE).day();
  if (day >= 1 && day <= 5) return isNowWithinWindow(hours.weekdays);
  if (day === 6) return isNowWithinWindow(hours.saturday);
  return isNowWithinWindow(hours.sunday);
};

export const registerUserController = async (req: Request, res: Response) => {
  const user = req.body;
  console.log("User:",user)
  try {
    const normalizedRole = String(user?.role || "").toLowerCase();
    if (!ASSIGNABLE_USER_ROLES.includes(normalizedRole as any)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    const checkEmail = await UserService.findByEmailService(user.email);
    if (checkEmail) {
      res.status(500).json({ error: "Email is already taken" });
      return;
    }
    if (!String(user?.password || "").trim()) {
      return res.status(400).json({ error: "La contrasena es obligatoria" });
    }
    console.log("Email not taken");
    const encryptPassword = await hashPassword(user.password);
    console.log("Encriptado");
    const newUser = await UserService.registerUserService({
      ...user,
      role: normalizedRole,
      password: encryptPassword,
      sucursal: resolveUserBranchForRole(normalizedRole, user.sucursal ?? user.sucursalId),
      system_access_hours: normalizedRole === "operator" ? normalizeAccessHours(user.system_access_hours) : undefined,
      must_change_password: true,
    });
    res.json({
      status: true,
      user: serializeUserForClient(newUser),
    });
    console.log("Usuario registrado");
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
};

export const loginUserController = async (req: Request, res: Response) => {
  const { email, password, sucursalId } = req.body;

  try {
    const user = await UserService.findByEmailService(String(email || "").trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, msg: "Credenciales invalidas" });
    }

    const lockedUntil = user.login_locked_until ? new Date(user.login_locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(429).json({
        success: false,
        msg: `Demasiados intentos fallidos. Intenta nuevamente despues de ${lockedUntil.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}.`,
      });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      const failedAttempts = Number(user.failed_login_attempts || 0) + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      user.failed_login_attempts = failedAttempts;
      user.login_locked_until = shouldLock
        ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000)
        : null;
      await user.save();

      if (shouldLock) {
        return res.status(429).json({
          success: false,
          msg: `Demasiados intentos fallidos. La cuenta fue bloqueada por ${LOGIN_LOCK_MINUTES} minutos.`,
        });
      }

      return res.status(401).json({ success: false, msg: "Credenciales invalidas" });
    }

    user.failed_login_attempts = 0;
    user.login_locked_until = null;
    await user.save();

    let id_vendedor = null;
    let nombre_vendedor = null;

    const actualRole = normalizeUserRole(user.role);

    if (actualRole === "operator") {
      const assignedBranchId = resolveIdString(user.sucursal);
      const selectedBranchId = String(sucursalId || "").trim();

      if (!Types.ObjectId.isValid(assignedBranchId)) {
        return res.status(403).json({
          success: false,
          msg: "El operador no tiene una sucursal asignada",
        });
      }

      if (!Types.ObjectId.isValid(selectedBranchId) || assignedBranchId !== selectedBranchId) {
        return res.status(403).json({
          success: false,
          msg: "El operador solo puede ingresar a su sucursal asignada",
        });
      }

      if (!canOperatorLogin(user.system_access_hours as AccessHours | undefined)) {
        return res.status(403).json({
          success: false,
          msg: "El acceso al sistema no esta habilitado en este horario",
        });
      }
    }

    if (actualRole === "seller") {
      const vendedor = await resolveSellerByUserData(user);
      if (vendedor) {
        if (!sellerHasSystemAccess(vendedor.fecha_vigencia)) {
          clearAuthCookie(res);
          return res.status(403).json({
            success: false,
            msg: SELLER_SYSTEM_ACCESS_DENIED_MESSAGE,
          });
        }
        id_vendedor = vendedor._id;
        nombre_vendedor = `${vendedor.nombre} ${vendedor.apellido}`;
      }
    }

    const token = generateToken(user._id.toString(), actualRole, sucursalId);

    res
      .cookie("token", token, {
        maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000,
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
      })
      .json({
        success: true,
        ...serializeUserForClient(user),
        id_vendedor,
        nombre_vendedor, 
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const changePasswordController = async (req: Request, res: Response) => {
  try {
    const userId = String(res.locals.auth?.id || "");
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    console.log("[change-password] controller", {
      userId,
      hasCurrentPassword: Boolean(currentPassword),
      hasNewPassword: Boolean(newPassword),
      hasConfirmPassword: Boolean(confirmPassword),
    });

    if (!userId) {
      return res.status(401).json({ success: false, msg: "No autenticado" });
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, msg: "Completa todos los campos" });
    }
    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ success: false, msg: "Las contrasenas no coinciden" });
    }

    const user = await UserService.getUserByIdService(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    const currentPasswordMatches = await comparePassword(String(currentPassword), user.password);
    if (!currentPasswordMatches) {
      return res.status(401).json({ success: false, msg: "La contrasena actual no es correcta" });
    }

    const isSamePassword = await comparePassword(String(newPassword), user.password);
    if (isSamePassword) {
      return res.status(400).json({ success: false, msg: "La nueva contrasena debe ser diferente" });
    }

    assertPasswordStrength(String(newPassword));
    const hashedPassword = await hashPassword(String(newPassword));
    const updatedUser = await UserService.updateUserPassword(userId, hashedPassword);

    res.json({
      success: true,
      msg: "Contrasena actualizada correctamente",
      data: serializeUserForClient(updatedUser),
    });
  } catch (error: any) {
    const status = Number(error?.status || 500);
    res.status(status).json({
      success: false,
      msg: error?.message || "Error al cambiar contraseña",
      details: error?.details,
    });
  }
};

const resolveResetPasswordFromProfile = async (user: any) => {
  if (user?.vendedor) {
    const vendedor = await VendedorModel.findById(user.vendedor).select("carnet").lean();
    const carnet = String((vendedor as any)?.carnet || "").trim();
    if (carnet) return carnet;
  }

  if (user?.role && String(user.role).toLowerCase() === "seller" && user?.email) {
    const vendedor = await VendedorModel.findOne({ mail: user.email }).select("carnet").lean();
    const carnet = String((vendedor as any)?.carnet || "").trim();
    if (carnet) return carnet;
  }

  if (user?.trabajador) {
    const trabajador = await TrabajadorModel.findById(user.trabajador).select("numero").lean();
    const numero = String((trabajador as any)?.numero || "").trim();
    if (numero) return numero;
  }

  return "";
};

export const resetUserPasswordToCarnetController = async (req: Request, res: Response) => {
  try {
    const userId = String(req.params?.id || "").trim();
    if (!userId) {
      return res.status(400).json({ success: false, msg: "Usuario requerido" });
    }

    const user = await UserService.getUserByIdService(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    const carnetPassword = await resolveResetPasswordFromProfile(user);
    if (!carnetPassword) {
      return res.status(400).json({
        success: false,
        msg: "No se pudo obtener un carnet o numero para restablecer la contrasena",
      });
    }

    const hashedPassword = await hashPassword(carnetPassword);
    const updatedUser = await UserService.updateUserPassword(userId, hashedPassword);

    return res.json({
      success: true,
      msg: "Contrasena restablecida al carnet",
      data: serializeUserForClient(updatedUser),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      msg: error?.message || "Error al restablecer contrasena",
    });
  }
};

export const resetSellerPasswordController = async (req: Request, res: Response) => {
  try {
    const sellerId = String(req.params?.sellerId || "").trim();
    const newPassword = String(req.body?.newPassword ?? "");

    if (!sellerId) {
      return res.status(400).json({ success: false, msg: "Vendedor requerido" });
    }

    if (!newPassword) {
      return res.status(400).json({ success: false, msg: "La nueva contraseña es obligatoria" });
    }

    const seller = await VendedorModel.findById(sellerId).select("mail carnet").lean();
    if (!seller) {
      return res.status(404).json({ success: false, msg: "Vendedor no encontrado" });
    }

    const normalizedMail = String((seller as any)?.mail || "").trim().toLowerCase();
    let user = normalizedMail ? await UserService.findByEmailService(normalizedMail) : null;

    if (!user) {
      user = await UserModel.findOne({ vendedor: sellerId }).lean();
    }

    if (!user) {
      return res.status(404).json({ success: false, msg: "Usuario asociado no encontrado" });
    }

    const hashedPassword = await hashPassword(newPassword);
    const updatedUser = await UserService.updateUserPassword(String(user._id), hashedPassword);

    return res.json({
      success: true,
      msg: "Contrasena restablecida correctamente",
      data: serializeUserForClient(updatedUser),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      msg: error?.message || "Error al restablecer la contrasena",
    });
  }
};

export const getUserInfoController = async (req: Request, res: Response) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ msg: "Token no encontrado" });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await UserService.getUserByIdService(decoded.id);

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const userObj = serializeUserForClient(user);

  if (normalizeUserRole(user.role) === "seller") {
    const vendedor = await VendedorModel.findOne({ mail: userObj.email });
    if (vendedor) {
      const sellerAccessData = vendedor.toObject?.() as SellerProductInfoAccessShape | undefined;
      userObj.id_vendedor = vendedor._id;
      userObj.nombre_vendedor = `${vendedor.nombre} ${vendedor.apellido}`;
      userObj.can_access_seller_product_info = canAccessSellerProductInfoByCommission({
        comision_porcentual: Number(sellerAccessData?.comision_porcentual ?? 0),
        comision_fija: Number(sellerAccessData?.comision_fija ?? 0),
        fecha_vigencia: sellerAccessData?.fecha_vigencia,
      });
      userObj.seller_has_commission_service = hasConfiguredCommissionService({
        pago_sucursales: Array.isArray(sellerAccessData?.pago_sucursales)
          ? sellerAccessData.pago_sucursales
          : [],
      });
      userObj.seller_has_simple_package_service = hasConfiguredSimplePackageService({
        pago_sucursales: Array.isArray(sellerAccessData?.pago_sucursales)
          ? sellerAccessData.pago_sucursales
          : [],
      });
      userObj.seller_can_access_inventory = userObj.seller_has_commission_service === true;
      userObj.seller_amortizacion = sellerAccessData?.amortizacion ?? null;
      userObj.seller_precio_paquete = sellerAccessData?.precio_paquete ?? null;
    }
  }
    //console.log("Enviando al frontend:", userObj);
    res.json({ success: true, data: userObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener usuario" });
  }
};

export const logoutUserController = async (req: Request, res: Response) => {
  try {
    res
      .clearCookie("token", {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
      })
      .json({ msg: "Log out successfull" });
  } catch (error) {
    res.status(500).json({ msg: "Error logging out user" });
  }
};

export const getAllUsersController = async (req: Request, res: Response) => {
  try {
    const users = await UserService.getAllUsers();
    res.json({ success: true, data: users.map((user) => serializeUserForClient(user)) });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Error al obtener usuarios" });
  }
};

export const getAdminsController = async (req: Request, res: Response) => {
  try {
    const admins = await UserService.getAdmins(); 

    const formatted = await Promise.all(
      admins.map(async (admin) => {
        const vendedor = await VendedorModel.findOne({ mail: admin.email });

        const name = vendedor
          ? `${vendedor.nombre} ${vendedor.apellido}`.trim()
          : admin.email;

        return {
          _id: admin._id,
          name,
        };
      })
    );

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching admins:", err);
    res.status(500).json({ error: "Error al obtener administradores" });
  }
};

export const updateUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role, password, sucursal, sucursalId, system_access_hours } = req.body;
    const authRole = normalizeUserRole(res.locals.auth?.role);
    const existingUser = await UserService.getUserByIdService(id);

    if (!existingUser) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    const existingRole = normalizeUserRole(existingUser.role);
    if (existingRole === "superadmin" && authRole !== "superadmin") {
      return res.status(403).json({ success: false, msg: "No se puede modificar este usuario" });
    }

    const normalizedRole = String(role || "").toLowerCase();
    if (!ASSIGNABLE_USER_ROLES.includes(normalizedRole as any)) {
      return res.status(400).json({ success: false, msg: "Rol inválido" });
    }
    
    if (existingRole !== normalizedRole && authRole !== "superadmin") {
      return res.status(403).json({ success: false, msg: "Solo superadmin puede asignar roles" });
    }

    if (system_access_hours && authRole !== "superadmin") {
      return res.status(403).json({ success: false, msg: "Solo superadmin puede definir horarios de acceso" });
    }

    const updateData: any = {
      email,
      role: existingRole === "superadmin" ? "superadmin" : normalizedRole,
      sucursal: resolveUserBranchForRole(normalizedRole, sucursal ?? sucursalId),
    };

    if (normalizedRole === "operator") {
      updateData.system_access_hours = normalizeAccessHours(system_access_hours) ?? existingUser.system_access_hours;
    } else {
      updateData.system_access_hours = null;
    }
    
    if (password) {
      updateData.password = await hashPassword(password);
      updateData.must_change_password = true;
      updateData.password_changed_at = null;
      updateData.failed_login_attempts = 0;
      updateData.login_locked_until = null;
    }

    const updatedUser = await UserService.updateUser(id, updateData);
    res.json({ success: true, data: serializeUserForClient(updatedUser) });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Error al actualizar usuario" });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authRole = normalizeUserRole(res.locals.auth?.role);
    const existingUser = await UserService.getUserByIdService(id);

    if (!existingUser) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    if (isSuperadminRole(existingUser.role) && authRole !== "superadmin") {
      return res.status(403).json({ success: false, msg: "No se puede eliminar este usuario" });
    }

    await UserService.deleteUser(id);
    res.json({ success: true, msg: "Usuario eliminado" });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Error al eliminar usuario" });
  }
};
