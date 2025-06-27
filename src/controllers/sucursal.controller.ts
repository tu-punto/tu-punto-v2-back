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

export const registerSucursalController = async (
  req: Request,
  res: Response
) => {
  const sucursal = req.body;
  try {
    const newSucursal = await SucursalsService.registerSucursal(sucursal);
    res.json({
      status: true,
      newSucursal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSucursalByIdController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  try {
    const sucursal = await SucursalsService.getSucursalByID(parseInt(id));
    res.json(sucursal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};

export const updateSucursalController = async (req: Request, res: Response) => {
  const sucursalId = req.params.id;
  const newData = req.body; 
  try {
    const updatedSucursal = await SucursalsService.updateSucursal(
      sucursalId,
      newData
    );
    res.json({ status: true, updatedSucursal });
  } catch (error) {
    res.status(500).json({ msg: "Internal server error", error });
  }
};

export const SucursalController = {
  getAllSucursals,
};
