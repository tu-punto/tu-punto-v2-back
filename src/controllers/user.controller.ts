import { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { CategoryService } from "../services/category.service";
import { comparePassword, hashPassword } from "../helpers/auth";
import { UserService } from "../services/user.service";
import { generateToken } from "../helpers/jwt";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "LKDSJF";
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
  const data = req.body;
  try {
    const user = await UserService.findByEmailService(data.email);
    if (!user) {
      res.status(401).json({ error: "User with such email does not exist" });
      return;
    }

    const isMatch = await comparePassword(data.password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    const token = generateToken(user.id_user, user.role);
    res
      .cookie("token", token, {
        maxAge: 900000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
      })
      .json({ ...user, password: "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUserInfoController = async (req: Request, res: Response) => {
  const { token } = req.cookies;
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
