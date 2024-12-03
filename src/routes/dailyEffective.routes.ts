import { Router } from "express";
import {
  getAllDailyEffectiveController,
  getDailyEffectiveByIdController,
  registerDailyEffectiveController,
} from "../controllers/dailyEffective.controller";

const dailyEffectiveRouter = Router();

dailyEffectiveRouter.get("/", getAllDailyEffectiveController);

dailyEffectiveRouter.post("/register", registerDailyEffectiveController);

dailyEffectiveRouter.get("/:id", getDailyEffectiveByIdController);

export default dailyEffectiveRouter;
