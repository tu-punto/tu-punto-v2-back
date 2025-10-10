import { Request, Response } from "express";
import { FinanceFluxService } from "../services/financeFlux.service";

export const getFinanceFluxes = async (_: Request, res: Response) => {
  try {
    const fluxRecords = await FinanceFluxService.getAllFinanceFluxes();
    res.json(fluxRecords);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo flujos", err });
  }
};

export const registerFinanceFlux = async (req: Request, res: Response) => {
  try {
    const fluxPayload = req.body;
    const createdFlux = await FinanceFluxService.registerFinanceFlux(
      fluxPayload
    );
    res.json({ ok: true, createdFlux });
  } catch (err) {
    res.status(500).json({ msg: "Error registrando flujo", err });
  }
};

export const payDebt = async (req: Request, res: Response) => {
  try {
    const fluxIdParam = req.params.id;
    await FinanceFluxService.payDebt(fluxIdParam);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
};

export const getWorker = async (req: Request, res: Response) => {
  try {
    const workerId = parseInt(req.params.id);
    const workerInfo = await FinanceFluxService.getWorkerById(workerId);
    res.json(workerInfo);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo trabajador", err });
  }
};


export const updateFinanceFlux = async (req: Request, res: Response) => {
  try {
    const fluxId = req.params.id;
    const updates = req.body;

    const updatedFlux = await FinanceFluxService.updateFinanceFlux(fluxId, updates);
    res.json({ ok: true, updatedFlux });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
};

export const getSeller = async (req: Request, res: Response) => {
  try {
    const sellerId = parseInt(req.params.id);
    const sellerInfo = await FinanceFluxService.getSellerById(sellerId);
    res.json(sellerInfo);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo vendedor", err });
  }
};

export const getSellerInfo = async (req: Request, res: Response) => {
  try {
    const sellerId = parseInt(req.params.id);
    const fluxHistory = await FinanceFluxService.getSellerInfoById(sellerId);
    res.json(fluxHistory);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo info vendedor", err });
  }
};

export const getStatsController = async (_: Request, res: Response) => {
  try {
    const stats = await FinanceFluxService.getStatsService();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ msg: "Error calculando estadísticas", err });
  }
};

export const getFinancialSummaryController = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const filters: any = {};

    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
      const endDateTime = new Date(endDate as string);
      endDateTime.setHours(23, 59, 59, 999);
      filters.endDate = endDateTime;
    }

    console.log("🔍 Filters applied:", filters);

    // Pasar filters solo si existen, sino undefined para obtener todos los datos
    const summary = await FinanceFluxService.getFinancialSummary(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.json(summary);
  } catch (err) {
    console.error("❌ Error in financial summary:", err);
    res.status(500).json({ msg: "Error calculando resumen financiero", err });
  }
};