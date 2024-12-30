import { Router } from "express";
import {
  getAllDailyEffectiveController,
  getDailyEffectiveByIdController,
  registerDailyEffectiveController,
  updateDailyEffectiveController,
} from "../controllers/dailyEffective.controller";

const dailyEffectiveRouter = Router();

dailyEffectiveRouter.get("/", getAllDailyEffectiveController);

dailyEffectiveRouter.post("/register", registerDailyEffectiveController);

dailyEffectiveRouter.get("/:id", getDailyEffectiveByIdController);

dailyEffectiveRouter.put("/update/:id", updateDailyEffectiveController);

export default dailyEffectiveRouter;
