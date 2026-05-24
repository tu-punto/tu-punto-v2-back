import { Router } from "express";
import {
  getTrackingFreezeConfig,
  updateTrackingFreezeConfig,
} from "../controllers/trackingFreeze.controller";

const trackingFreezeRouter = Router();

trackingFreezeRouter.get("/", getTrackingFreezeConfig);
trackingFreezeRouter.patch("/", updateTrackingFreezeConfig);

export default trackingFreezeRouter;
