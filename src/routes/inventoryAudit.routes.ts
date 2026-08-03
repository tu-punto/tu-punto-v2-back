import { Router } from "express";
import {
  exportInventoryAuditXlsx,
  getInventoryAuditEventDetail,
  listInventoryAuditMovements,
  updateInventoryAuditMovementResolved,
} from "../controllers/inventoryAudit.controller";

const inventoryAuditRouter = Router();

inventoryAuditRouter.get("/movements", listInventoryAuditMovements);
inventoryAuditRouter.get("/events/:id", getInventoryAuditEventDetail);
inventoryAuditRouter.get("/export/xlsx", exportInventoryAuditXlsx);
inventoryAuditRouter.patch("/movements/:id/resolved", updateInventoryAuditMovementResolved);

export default inventoryAuditRouter;
