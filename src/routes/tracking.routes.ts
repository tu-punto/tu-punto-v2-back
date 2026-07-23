import { Router } from "express";
import {
  getPublicTrackingController,
  registerBuyerPushSubscriptionController,
} from "../controllers/notification.controller";
import { rateLimiters } from "../middlewares/rateLimit.middleware";
import { validateRequest } from "../middlewares/validate.middleware";
import { validatePushSubscriptionBody, validateTrackingParams } from "../validation/tracking.validation";

const trackingRouter = Router();

trackingRouter.get(
  "/:code",
  rateLimiters.publicTracking,
  validateRequest({ params: validateTrackingParams }),
  getPublicTrackingController
);
trackingRouter.post(
  "/:code/push-subscriptions",
  rateLimiters.buyerPushSubscription,
  validateRequest({ params: validateTrackingParams, body: validatePushSubscriptionBody }),
  registerBuyerPushSubscriptionController
);

export default trackingRouter;
