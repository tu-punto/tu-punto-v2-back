import { Router } from "express";
import {
  getMaintenanceModeController,
  getMaintenanceModeStatusController,
  updateMaintenanceModeController,
} from "../controllers/maintenanceMode.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const maintenanceModeRouter = Router();

maintenanceModeRouter.get("/status", requireAuth, getMaintenanceModeStatusController);
maintenanceModeRouter.get("/current", requireAuth, requireRole("superadmin"), getMaintenanceModeController);
maintenanceModeRouter.put("/", requireAuth, requireRole("superadmin"), updateMaintenanceModeController);

export default maintenanceModeRouter;
