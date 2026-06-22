import { Request, Response } from "express";
import { TrackingFreezeService } from "../services/trackingFreeze.service";

export const getTrackingFreezeConfig = async (_req: Request, res: Response) => {
  try {
    const config = await TrackingFreezeService.getConfig();
    return res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudo obtener el congelamiento",
    });
  }
};

export const updateTrackingFreezeConfig = async (req: Request, res: Response) => {
  try {
    const result = await TrackingFreezeService.setEnabled(req.body?.enabled === true, res.locals.auth?.id);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo actualizar el congelamiento",
    });
  }
};
