import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { annulExternalOrder, createExternalOrder, listExternalOrders, updateExternalOrder } from "../controllers/paqueteriaExternaPortal.controller";
const router = Router(); router.use(requireAuth, requireRole("paqueteria")); router.get("/orders", listExternalOrders); router.post("/orders", createExternalOrder); router.put("/orders/:id", updateExternalOrder); router.post("/orders/:id/annul", annulExternalOrder); export default router;
