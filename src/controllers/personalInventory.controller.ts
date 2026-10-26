import { Request, Response } from "express";
import { PersonalInventoryService } from "../services/personalInventory.service";

const sellerId = (res: Response) => String((res.locals.auth as any)?.sellerId || "");
const run = (handler: (req: Request, seller: string) => Promise<unknown>) => async (req: Request, res: Response) => {
  const seller = sellerId(res);
  if (!seller) return res.status(403).json({ success: false, msg: "No se pudo identificar al vendedor" });
  try { return res.json({ success: true, data: await handler(req, seller) }); }
  catch (error: any) { const msg = error?.message || "No se pudo completar la operacion"; return res.status(/stock insuficiente/i.test(msg) ? 409 : /no encontrado/i.test(msg) ? 404 : 400).json({ success: false, msg }); }
};

export const PersonalInventoryController = {
  listProducts: run((req, seller) => PersonalInventoryService.listProducts(seller, String(req.query.q || ""))),
  createProduct: run((req, seller) => PersonalInventoryService.createProduct(seller, req.body)),
  updateProduct: run((req, seller) => PersonalInventoryService.updateProduct(seller, req.params.id, req.body)),
  adjustStock: run((req, seller) => PersonalInventoryService.adjustStock(seller, req.params.id, req.body)),
  createSale: run((req, seller) => PersonalInventoryService.createSale(seller, req.body)),
  createExpense: run((req, seller) => PersonalInventoryService.createExpense(seller, req.body)),
  history: run((req, seller) => PersonalInventoryService.history(seller, req.query)),
};
