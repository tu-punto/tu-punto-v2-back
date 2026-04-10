import { Router } from "express";
import {
  getPublicTrackingController,
  registerBuyerPushSubscriptionController,
} from "../controllers/notification.controller";

const trackingRouter = Router();

trackingRouter.get("/:code", getPublicTrackingController);
trackingRouter.post("/:code/push-subscriptions", registerBuyerPushSubscriptionController);

export default trackingRouter;
