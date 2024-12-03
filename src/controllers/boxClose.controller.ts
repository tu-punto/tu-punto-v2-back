import { Request, Response } from "express";
import { BoxCloseService } from "../services/boxClose.service";

export const getBoxClosingsController = async (req: Request, res: Response) => {
  try {
    const boxClosings = await BoxCloseService.getAllBoxClosings();
    res.json(boxClosings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerBoxCloseController = async (
  req: Request,
  res: Response
) => {
  const boxClose = req.body;
  try {
    const newBoxClose = await BoxCloseService.registerBoxClose(boxClose);
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
    const boxClose = await BoxCloseService.getBoxCloseById(parseInt(id));
    res.json(boxClose);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
