import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { CategoryService } from "../services/category.service";
import { comparePassword, hashPassword } from "../helpers/auth";
import { UserService } from "../services/user.service";
import { generateToken } from "../helpers/jwt";
import { VendedorModel } from "../entities/implements/VendedorSchema"; 
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

const JWT_SECRET = process.env.JWT_SECRET || "LKDSJF";
const isSecure = process.env.NODE_ENV === "production";

const clearAuthCookie = (res: Response) =>
  res.clearCookie("token", {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "strict" : "lax",
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
  amortizacion?: number;
  precio_paquete?: number;
  fecha_vigencia?: unknown;
};

const serializeUserForClient = (user: any) => {
  const userObj = user?.toObject?.() || { ...(user || {}) };
  delete userObj.password;

  const actualRole = normalizeUserRole(userObj.role);

  return {
    ...userObj,
    role: getPublicUserRole(actualRole),
    is_superadmin: actualRole === "superadmin",
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
    console.log("Email not taken");
    const encryptPassword = await hashPassword(user.password);
    console.log("Encriptado");
    const newUser = await UserService.registerUserService({
      ...user,
      role: normalizedRole,
      password: encryptPassword,
      sucursal: resolveUserBranchForRole(normalizedRole, user.sucursal ?? user.sucursalId),
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
    const user = await UserService.findByEmailService(email);

    if (!user) {
      return res.status(401).json({ success: false, msg: "Credenciales invalidas" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, msg: "Credenciales invalidas" });
    }

    let id_vendedor = null;
    let nombre_vendedor = null;

    const actualRole = normalizeUserRole(user.role);

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
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "strict" : "lax",
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
      userObj.seller_amortizacion = Number(sellerAccessData?.amortizacion ?? 0);
      userObj.seller_precio_paquete = Number(sellerAccessData?.precio_paquete ?? 0);
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
    const { email, role, password, sucursal, sucursalId } = req.body;
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

    const updateData: any = {
      email,
      role: existingRole === "superadmin" ? "superadmin" : normalizedRole,
      sucursal: resolveUserBranchForRole(normalizedRole, sucursal ?? sucursalId),
    };
    
    if (password) {
      updateData.password = await hashPassword(password);
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
