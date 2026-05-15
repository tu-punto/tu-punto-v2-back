import { Request, Response } from "express";
import { SimplePackageService } from "../services/simplePackage.service";
import { OrderGuideWhatsappService } from "../services/orderGuideWhatsapp.service";
export {
  getPackageEscalationConfig,
  getSimplePackageEscalationStatus,
  upsertPackageEscalationConfig,
} from "./packageEscalationConfig.controller";

const resolveActor = (res: Response) => ({
  role: String(res.locals.auth?.role || "").toLowerCase(),
  sellerId: String(res.locals.auth?.sellerId || ""),
  sucursalId: String(res.locals.auth?.sucursalId || ""),
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
      role: actor.role,
      originBranchId: (
        actor.role === "seller"
          ? String(req.body?.originBranchId || req.body?.origen_sucursal_id || req.body?.sucursalId || req.body?.id_sucursal || "")
          : actor.sucursalId || String(req.body?.originBranchId || req.body?.origen_sucursal_id || req.body?.sucursalId || req.body?.id_sucursal || "")
      ).trim() || undefined,
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
      originBranchId: actor.role === "seller" ? undefined : actor.sucursalId || undefined,
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
    const actor = resolveActor(res);
    const rows = await SimplePackageService.getUploadedSimplePackageSellers(
      actor.role === "seller" ? undefined : actor.sucursalId || undefined
    );
    return res.json({ success: true, rows });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudo obtener la lista de vendedores",
    });
  }
};

export const getSellerAccountingSimplePackages = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const targetSellerId =
      actor.role === "seller"
        ? actor.sellerId
        : String(req.query.sellerId || req.params.sellerId || "").trim();

    if (!targetSellerId) {
      return res.json({ success: true, rows: [] });
    }

    const rows = await SimplePackageService.getSellerAccountingSimplePackages(targetSellerId);
    return res.json({ success: true, rows });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error?.message || "No se pudo obtener la contabilidad de paquetes simples",
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

export const createSimplePackageOrders = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const paymentMethod = String(req.body?.paymentMethod || "").trim().toLowerCase();
    const created = await SimplePackageService.createSimplePackageOrders({
      packageIds: Array.isArray(req.body?.packageIds) ? req.body.packageIds : [],
      role: actor.role,
      currentBranchId: actor.role === "seller" ? undefined : actor.sucursalId,
      paymentMethod: paymentMethod === "efectivo" || paymentMethod === "qr" ? (paymentMethod as "efectivo" | "qr") : "",
    });

    return res.json({
      success: true,
      createdCount: created.length,
      data: created,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudieron crear los pedidos simples",
    });
  }
};

export const printSimplePackageGuidesController = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const rows = await SimplePackageService.printSimplePackageGuides({
      packageIds: Array.isArray(req.body?.packageIds) ? req.body.packageIds : [],
      role: actor.role,
      authSellerId: actor.sellerId,
      currentBranchId: actor.role === "seller" ? undefined : actor.sucursalId,
    });

    return res.json({
      success: true,
      printedCount: rows.length,
      rows,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudieron imprimir los QRs",
    });
  }
};

export const sendSimplePackageGuideWhatsappController = async (req: Request, res: Response) => {
  try {
    const actor = resolveActor(res);
    const result = await OrderGuideWhatsappService.sendSimplePackageGuideMessages({
      packageIds: Array.isArray(req.body?.packageIds) ? req.body.packageIds : [],
      role: actor.role,
      authSellerId: actor.sellerId,
      currentBranchId: actor.role === "seller" ? undefined : actor.sucursalId,
    });

    return res.json({
      ...result,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      success: false,
      message: error?.message || "No se pudo enviar WhatsApp de las guias",
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
