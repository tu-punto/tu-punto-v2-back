import { Request, Response } from "express";
import { PackageEscalationConfigService } from "../services/packageEscalationConfig.service";

const resolveActor = (res: Response) => ({
  role: String(res.locals.auth?.role || "").toLowerCase(),
});

export const getPackageEscalationConfig = async (req: Request, res: Response) => {
  try {
    const routeId = String(req.query.routeId || req.query.rutaId || "").trim();
    const data = routeId
      ? await PackageEscalationConfigService.getConfigForRoute(routeId)
      : await PackageEscalationConfigService.listConfigs();

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo obtener la configuracion de escalonamiento",
    });
  }
};

export const upsertPackageEscalationConfig = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    if (actor.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Solo superadmin puede editar el escalonamiento",
      });
    }

    const data = await PackageEscalationConfigService.upsertConfig({
      routeId: String(req.body?.routeId || req.body?.rutaId || "").trim(),
      serviceOrigin: req.body?.serviceOrigin || req.body?.service_origin,
      ranges: Array.isArray(req.body?.ranges) ? req.body.ranges : [],
    });

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo guardar el escalonamiento",
    });
  }
};

export const getSimplePackageEscalationStatus = async (req: Request, res: Response) => {
  try {
    const data = await PackageEscalationConfigService.getSimpleEscalationStatus({
      routeId: String(req.query.routeId || req.query.rutaId || "").trim(),
      sellerId: String(req.query.sellerId || req.query.vendedorId || "").trim(),
    });

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo obtener el estado de escalonamiento",
    });
  }
};
