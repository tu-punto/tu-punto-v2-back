import { Router } from "express";
import { listActionTraceActorsController, listActionTracesController } from "../controllers/actionTrace.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const actionTraceRouter = Router();

actionTraceRouter.get("/actors", requireAuth, requireRole("superadmin"), listActionTraceActorsController);
actionTraceRouter.get("/", requireAuth, requireRole("superadmin"), listActionTracesController);

export default actionTraceRouter;
