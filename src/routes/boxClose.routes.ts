import { Router } from "express";
import {
  deletePendingBoxCloseOperationController,
  getBoxCloseByIdController,
  getBoxClosingsController,
  getPendingBoxCloseOperationsController,
  getBoxCloseSummaryController,
  registerPendingBoxCloseOperationController,
  registerBranchTransferBoxCloseOperationController,
  registerBoxCloseController,
  updateBoxCloseController,
} from "../controllers/boxClose.controller";
import { requireRole } from "../middlewares/auth.middleware";

const boxCloseRouter = Router();

boxCloseRouter.get("/", getBoxClosingsController);

boxCloseRouter.get("/summary", requireRole("superadmin"), getBoxCloseSummaryController);
boxCloseRouter.get("/pending-operations", getPendingBoxCloseOperationsController);

boxCloseRouter.post("/register", registerBoxCloseController);
boxCloseRouter.post("/pending-operation", registerPendingBoxCloseOperationController);
boxCloseRouter.post("/branch-transfer-operation", registerBranchTransferBoxCloseOperationController);

boxCloseRouter.get("/:id", getBoxCloseByIdController);

boxCloseRouter.patch("/:id", updateBoxCloseController);
boxCloseRouter.delete("/pending-operation/:sourceKey", deletePendingBoxCloseOperationController);

export default boxCloseRouter;
