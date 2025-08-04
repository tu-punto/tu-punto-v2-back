import { Request, Response } from "express";
import { BoxCloseService } from "../services/boxClose.service";
import { UserModel } from "../entities/implements/UserSchema";

export const getBoxClosingsController = async (req: Request, res: Response) => {
  try {
    const boxClosings = await BoxCloseService.getAllBoxClosings();
    res.json(boxClosings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerBoxCloseController = async (req: Request, res: Response) => {
  const boxClose = req.body;

  try {
    const responsable = boxClose.responsable;

    if (!responsable || !responsable.id || !responsable.nombre) {
      return res.status(400).json({ error: "Datos de responsable incompletos" });
    }

    const newBoxClose = await BoxCloseService.registerBoxClose({
      ...boxClose,
      responsable,
    });

    res.json({
      status: true,
      newBoxClose,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getBoxCloseByIdController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  try {
    const boxClose = await BoxCloseService.getBoxCloseById(id);
    res.json(boxClose);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
