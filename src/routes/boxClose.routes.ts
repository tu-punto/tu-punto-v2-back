import { Router } from "express";
import {
  getBoxCloseByIdController,
  getBoxClosingsController,
  getBoxCloseSummaryController,
  registerBoxCloseController,
  updateBoxCloseController,
} from "../controllers/boxClose.controller";
import { requireRole } from "../middlewares/auth.middleware";

const boxCloseRouter = Router();

boxCloseRouter.get("/", getBoxClosingsController);

boxCloseRouter.get("/summary", requireRole("superadmin"), getBoxCloseSummaryController);

boxCloseRouter.post("/register", registerBoxCloseController);

boxCloseRouter.get("/:id", getBoxCloseByIdController);

boxCloseRouter.patch("/:id", updateBoxCloseController);

export default boxCloseRouter;
