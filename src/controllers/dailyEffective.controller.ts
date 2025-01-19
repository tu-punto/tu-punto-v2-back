import { Request, Response } from "express";
import { DailyEffectiveService } from "../services/dailyEffective.service";

export const getAllDailyEffectiveController = async (
  req: Request,
  res: Response
) => {
  try {
    const dailyEffectives = await DailyEffectiveService.getAllDailyEffective();
    res.json(dailyEffectives);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerDailyEffectiveController = async (
  req: Request,
  res: Response
) => {
  const dailyEffective = req.body;
  try {
    const newDailyEffective =
      await DailyEffectiveService.registerDailyEffective(dailyEffective);
    res.json({
      status: true,
      newDailyEffective,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDailyEffectiveByIdController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  try {
    const dailyEffective = await DailyEffectiveService.getDailyEffectiveById(
      parseInt(id)
    );
    res.json(dailyEffective);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};

export const updateDailyEffectiveController = async (
  req: Request,
  res: Response
) => {
  const dailyEffectiveId = parseInt(req.params.id);
  const { newData } = req.body;
  try {
    const updatedDailyEffective =
      await DailyEffectiveService.updateDailyEffective(
        dailyEffectiveId,
        newData
      );
    res.json({ status: true, updatedDailyEffective });
  } catch (error) {
    res.status(500).json({ msg: "Internal server error", error });
  }
};
