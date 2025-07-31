import { Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service";

export const getFinancialSummary = async (req: Request, res: Response) => {
  const { start, end, sucursalId } = req.query;

  try {
    const resumen = await DashboardService.getFinancialSummary(
      start as string,
      end as string,
      sucursalId as string
    );

    res.json(resumen);
  } catch (error) {
    console.error("Error obteniendo resumen financiero:", error);
    res.status(500).json({ msg: "Error interno", error });
  }
};
