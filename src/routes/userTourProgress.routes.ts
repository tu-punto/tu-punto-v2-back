import { Router } from "express";
import {
  completeTourController,
  getMyTourProgressController,
} from "../controllers/userTourProgress.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const userTourProgressRouter = Router();

userTourProgressRouter.get(
  "/mine",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  getMyTourProgressController
);

userTourProgressRouter.post(
  "/complete",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  completeTourController
);

export default userTourProgressRouter;
