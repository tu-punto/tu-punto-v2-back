import { Request, Response } from "express";
import { SimplePackageService } from "../services/simplePackage.service";

const resolveActor = (res: Response) => ({
  role: String(res.locals.auth?.role || "").toLowerCase(),
  sellerId: String(res.locals.auth?.sellerId || ""),
});

export const registerSimplePackages = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const targetSellerId =
      actor.role === "seller"
        ? actor.sellerId
        : String(req.body?.sellerId || req.body?.id_vendedor || "").trim();

    const created = await SimplePackageService.registerSimplePackages({
      sellerId: targetSellerId,
      paquetes: Array.isArray(req.body?.paquetes) ? req.body.paquetes : [],
      originBranchId:
        String(req.body?.originBranchId || req.body?.origen_sucursal_id || req.body?.sucursalId || req.body?.id_sucursal || "").trim() ||
        undefined,
    });

    res.json({
      success: true,
      createdCount: created.length,
      data: created,
    });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudieron registrar los paquetes",
    });
  }
};

export const getSimplePackageBranchPrices = async (req: Request, res: Response) => {
  try {
    const rows = await SimplePackageService.getSimplePackageBranchPrices(
      String(req.query.originBranchId || req.query.origen_sucursal_id || "").trim() || undefined
    );
    return res.json({ success: true, rows });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudieron obtener los precios entre sucursales",
    });
  }
};

export const upsertSimplePackageBranchPrice = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    if (actor.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Solo superadmin puede editar precios entre sucursales",
      });
    }

    const data = await SimplePackageService.upsertSimplePackageBranchPrice({
      originBranchId: String(req.body?.originBranchId || req.body?.origen_sucursal_id || "").trim(),
      destinationBranchId: String(req.body?.destinationBranchId || req.body?.destino_sucursal_id || "").trim(),
      precio: Number(req.body?.precio || 0),
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo guardar el precio entre sucursales",
    });
  }
};

export const getSimplePackagesList = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const targetSellerId =
      actor.role === "seller"
        ? actor.sellerId
        : String(req.query.sellerId || "").trim();

    if (!targetSellerId) {
      return res.json({ success: true, rows: [] });
    }

    const fromRaw = String(req.query.from || "").trim();
    const toRaw = String(req.query.to || "").trim();
    const rows = await SimplePackageService.getSimplePackagesList({
      sellerId: targetSellerId,
      from: fromRaw ? new Date(fromRaw) : undefined,
      to: toRaw ? new Date(toRaw) : undefined,
    });

    return res.json({ success: true, rows });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudieron obtener los paquetes",
    });
  }
};

export const getUploadedSimplePackageSellers = async (_req: Request, res: Response) => {
  try {
    const rows = await SimplePackageService.getUploadedSimplePackageSellers();
    return res.json({ success: true, rows });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudo obtener la lista de vendedores",
    });
  }
};

export const updateSimplePackageByID = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const data = await SimplePackageService.updateSimplePackageByID({
      id: req.params.id,
      payload: req.body,
      role: actor.role,
      authSellerId: actor.sellerId,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Paquete no encontrado",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo actualizar el paquete",
    });
  }
};

export const deleteSimplePackageByID = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const data = await SimplePackageService.deleteSimplePackageByID({
      id: req.params.id,
      role: actor.role,
      authSellerId: actor.sellerId,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Paquete no encontrado",
      });
    }

    return res.json({
      success: true,
      message: "Paquete eliminado",
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo eliminar el paquete",
    });
  }
};
