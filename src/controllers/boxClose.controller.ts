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

export const getBoxCloseSummaryController = async (req: Request, res: Response) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const sucursalIds = String(req.query.sucursalIds || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const boxClosings = await BoxCloseService.getBoxCloseSummary({ from, to, sucursalIds });
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
export const updateBoxCloseController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const updated = await BoxCloseService.updateBoxClose(id, updates);
    if (!updated) {
      return res.status(404).json({ error: "Cierre de caja no encontrado" });
    }
    res.json({ status: true, updated });
  } catch (error) {
    console.error("Error actualizando cierre de caja", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPendingBoxCloseOperationsController = async (req: Request, res: Response) => {
  try {
    const branchId = String(req.query.branchId || "").trim();
    const businessDate = String(req.query.businessDate || "").trim();

    if (!branchId || !businessDate) {
      return res.status(400).json({
        success: false,
        message: "branchId y businessDate son requeridos",
      });
    }

    const operations = await BoxCloseService.getPendingOperationsForBranchAndDate(branchId, businessDate);
    return res.json({
      success: true,
      operations,
    });
  } catch (error) {
    console.error("Error obteniendo operaciones pendientes de cierre", error);
    return res.status(500).json({
      success: false,
      message: "No se pudieron obtener las operaciones pendientes",
    });
  }
};

export const registerBranchTransferBoxCloseOperationController = async (req: Request, res: Response) => {
  try {
    const result = await BoxCloseService.registerBranchTransferBoxCloseOperation({
      sourceKey: String(req.body?.sourceKey || ""),
      branchId: String(req.body?.branchId || ""),
      amount: Number(req.body?.amount || 0),
      method: String(req.body?.method || "").trim().toLowerCase() === "qr" ? "qr" : "efectivo",
      mode: String(req.body?.mode || "").trim().toLowerCase() === "receive" ? "receive" : "send",
      occurredAt: req.body?.occurredAt,
      packageCount: Number(req.body?.packageCount || 0),
    });

    res.json(result);
  } catch (error) {
    console.error("Error registrando operacion automatica de cierre", error);
    res.status(500).json({ success: false, message: "No se pudo registrar la operacion de cierre" });
  }
};

