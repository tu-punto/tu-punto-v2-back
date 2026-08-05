import { Request, Response } from "express";
import { MaintenanceModeService } from "../services/maintenanceMode.service";

const getAuthContext = (res: Response) =>
  (res.locals.auth as { id?: string; role?: string } | undefined) || {};

export const getMaintenanceModeController = async (_req: Request, res: Response) => {
  try {
    const data = await MaintenanceModeService.getMaintenanceConfig();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, msg: error?.message || "No se pudo obtener la configuracion" });
  }
};

export const getMaintenanceModeStatusController = async (_req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const data = await MaintenanceModeService.evaluateMaintenanceForUser({
      userId: String(auth.id || ""),
      role: String(auth.role || ""),
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, msg: error?.message || "No se pudo evaluar el mantenimiento" });
  }
};

export const updateMaintenanceModeController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const data = await MaintenanceModeService.updateMaintenanceConfig({
      actorUserId: String(auth.id || ""),
      enabled: req.body?.enabled,
      message: req.body?.message,
      subtitle: req.body?.subtitle,
      allowedRoles: req.body?.allowedRoles,
      targetUserScope: req.body?.targetUserScope,
      targetUserIds: req.body?.targetUserIds,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, msg: error?.message || "No se pudo actualizar el mantenimiento" });
  }
};
