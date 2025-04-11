import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { CategoryService } from "../services/category.service";
import { comparePassword, hashPassword } from "../helpers/auth";
import { UserService } from "../services/user.service";
import { generateToken } from "../helpers/jwt";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "LKDSJF";
const isSecure = process.env.NODE_ENV === "production";
export const registerUserController = async (req: Request, res: Response) => {
  const user = req.body;
  try {
    const checkEmail = await UserService.findByEmailService(user.email);
    if (checkEmail) {
      res.status(500).json({ error: "Email is already taken" });
      return;
    }
    const encryptPassword = await hashPassword(user.password);
    const newUser = await UserService.registerUserService({
      ...user,
      password: encryptPassword,
    });
    res.json({
      status: true,
      user: { ...newUser, password: "" },
    });
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

    
    if (!user.sucursal || user.sucursal.toString() !== sucursalId) {
      return res.status(403).json({ error: "Access denied for this branch" });
    }

    const token = generateToken(parseInt(user._id.toString()), user.role, sucursalId);

    res
      .cookie("token", token, {
        maxAge: 900000,
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
      })
      .json({ ...user, password: "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getUserInfoController = async (req: Request, res: Response) => {
  const { token } = req.cookies;
  console.log(token);
  if (!token) {
    res.status(500).json({ msg: "Error getting token" });
    return;
  }
  try {
    const user = jwt.verify(token, JWT_SECRET, {});
    res.json(user);
  } catch (error) {
    res.status(500).json({ msg: "Error getting user" });
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
