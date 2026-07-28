import { Router } from "express";
import {
  exportInventoryAuditXlsx,
  getInventoryAuditEventDetail,
  listInventoryAuditMovements,
} from "../controllers/inventoryAudit.controller";

const inventoryAuditRouter = Router();

inventoryAuditRouter.get("/movements", listInventoryAuditMovements);
inventoryAuditRouter.get("/events/:id", getInventoryAuditEventDetail);
inventoryAuditRouter.get("/export/xlsx", exportInventoryAuditXlsx);

export default inventoryAuditRouter;
