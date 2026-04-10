import { Router } from "express";
import {
  getPushPublicConfigController,
  getUnreadNotificationsCountController,
  listNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
  registerInternalPushSubscriptionController,
} from "../controllers/notification.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const notificationRouter = Router();

notificationRouter.get("/push/public-key", getPushPublicConfigController);
notificationRouter.get(
  "/",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  listNotificationsController
);
notificationRouter.get(
  "/unread-count",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  getUnreadNotificationsCountController
);
notificationRouter.patch(
  "/:id/read",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  markNotificationAsReadController
);
notificationRouter.patch(
  "/read-all",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  markAllNotificationsAsReadController
);
notificationRouter.post(
  "/push-subscriptions",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  registerInternalPushSubscriptionController
);

export default notificationRouter;
