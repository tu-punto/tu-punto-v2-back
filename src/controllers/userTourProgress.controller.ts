import { Request, Response } from "express";
import { UserTourProgressService } from "../services/userTourProgress.service";

const getAuthUserId = (res: Response) => String(res.locals.auth?.id || "").trim();

export const getMyTourProgressController = async (_req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(res);
    const progress = await UserTourProgressService.getMyTourProgress(userId);

    res.json({
      success: true,
      progress,
      knownTourKeys: UserTourProgressService.knownTourKeys,
    });
  } catch (error: any) {
    console.error("[tour-progress] Error obteniendo progreso:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo obtener el progreso de tours",
    });
  }
};

export const completeTourController = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(res);
    const completed = await UserTourProgressService.markTourAsCompleted(
      userId,
      req.body?.tourKey
    );

    res.json({
      success: true,
      progress: completed,
    });
  } catch (error: any) {
    console.error("[tour-progress] Error marcando tour:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo actualizar el progreso del tour",
    });
  }
};
