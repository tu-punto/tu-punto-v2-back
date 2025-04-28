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
