import { Request, Response } from "express";
import { CatalogIntegrationService } from "../services/catalogIntegration.service";
import { CatalogOrderIntegrationService } from "../services/catalogOrderIntegration.service";

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

export const createCatalogOrder = async (req: Request, res: Response) => {
  try {
    const order = await CatalogOrderIntegrationService.createOrder(req.body);
    return res.status(201).json({
      success: true,
      orderId: order._id,
      stockItems: (order as any).catalog_stock_items || []
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || "Pedido invalido" });
  }
};
