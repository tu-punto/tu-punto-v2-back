import { Request, Response } from "express";
import { CatalogIntegrationService } from "../services/catalogIntegration.service";

export const getCatalogSnapshot = async (_req: Request, res: Response) => {
  try {
    const snapshot = await CatalogIntegrationService.buildSnapshot();
    return res.json(snapshot);
  } catch (error) {
    console.error("Error generando snapshot para catalogo:", error);
    return res.status(500).json({
      success: false,
      message: "Error generando snapshot para catalogo"
    });
  }
};
