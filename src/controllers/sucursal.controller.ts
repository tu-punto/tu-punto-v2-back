import { Request, Response } from "express";
import { SucursalsService } from "../services/sucursals.service";

const getAllSucursals = async (req: Request, res: Response) => {
  try {
    const sucursals = await SucursalsService.getAllSucursals();
    res.json(sucursals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Failed", error });
  }
};

export const SucursalController = {
  getAllSucursals,
};
