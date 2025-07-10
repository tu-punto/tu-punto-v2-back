import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { CategoryService } from "../services/category.service";
import { comparePassword, hashPassword } from "../helpers/auth";
import { UserService } from "../services/user.service";
import { generateToken } from "../helpers/jwt";
import { VendedorModel } from "../entities/implements/VendedorSchema"; 

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "LKDSJF";
const isSecure = process.env.NODE_ENV === "production";
export const registerUserController = async (req: Request, res: Response) => {
  const user = req.body;
  console.log("User:",user)
  try {
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
      password: encryptPassword,
    });
    res.json({
      status: true,
      user: { ...newUser, password: "" },
    });
    console.log("Usuario registrado");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const loginUserController = async (req: Request, res: Response) => {
  const { email, password, sucursalId } = req.body;

  try {
    const user = await UserService.findByEmailService(email);

    if (!user) {
      return res.status(401).json({ error: "User with such email does not exist" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const token = generateToken(user._id.toString(), user.role, sucursalId);

    let id_vendedor = null;
    let nombre_vendedor = null;

    if (user.role === "seller") {
      const vendedor = await VendedorModel.findOne({ mail: user.email });
      if (vendedor) {
        id_vendedor = vendedor._id;
        nombre_vendedor = `${vendedor.nombre} ${vendedor.apellido}`;
      }
    }

    res
      .cookie("token", token, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "strict" : "lax",
        path: "/",
      })
      .json({
        ...user.toObject?.() || user,
        password: "",
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

    const userObj = user.toObject?.() || user;
    delete userObj.password;

  if (userObj.role === "seller") {
    const vendedor = await VendedorModel.findOne({ mail: userObj.email });
    if (vendedor) {
      userObj.id_vendedor = vendedor._id;
      userObj.nombre_vendedor = `${vendedor.nombre} ${vendedor.apellido}`;
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
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Error al obtener usuarios" });
  }
};

export const updateUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role, password } = req.body;
    
    const updateData: any = { email, role };
    
    if (password) {
      updateData.password = await hashPassword(password);
    }

    const updatedUser = await UserService.updateUser(id, updateData);
    if (!updatedUser) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Error al actualizar usuario" });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await UserService.deleteUser(id);
    res.json({ success: true, msg: "Usuario eliminado" });
  } catch (error) {
    res.status(500).json({ success: false, msg: "Error al eliminar usuario" });
  }
};
