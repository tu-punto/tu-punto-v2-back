import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { CategoryService } from "../services/category.service";
import { comparePassword, hashPassword } from "../helpers/auth";
import { UserService } from "../services/user.service";
import { generateToken } from "../helpers/jwt";

dotenv.config();
export const getCategory = async (req: Request, res: Response) => {
  try {
    const categories = await CategoryService.getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerUserController = async (req: Request, res: Response) => {
  const user = req.body;
  try {
    //TODO: no dejar crear cuenta con un mismo correo
    const checkEmail = await UserService.findByEmailService(user.email);
    if (checkEmail) {
      res.status(500).json({ error: "Email is already taken" });
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
    res.cookie("token", token).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
