import { Router } from "express";
import {
  acknowledgeServiceAnnouncementController,
  acceptServiceAnnouncementController,
  createServiceAnnouncementController,
  getPendingServiceAnnouncementController,
  listAdminServiceAnnouncementsController,
  listMyServiceAnnouncementsController,
  publishServiceAnnouncementController,
} from "../controllers/serviceAnnouncement.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const serviceAnnouncementRouter = Router();

serviceAnnouncementRouter.get(
  "/mine",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  listMyServiceAnnouncementsController
);
serviceAnnouncementRouter.get(
  "/pending",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  getPendingServiceAnnouncementController
);
serviceAnnouncementRouter.post(
  "/:id/acknowledge",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  acknowledgeServiceAnnouncementController
);
serviceAnnouncementRouter.post(
  "/:id/accept",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  acceptServiceAnnouncementController
);
serviceAnnouncementRouter.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  listAdminServiceAnnouncementsController
);
serviceAnnouncementRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  createServiceAnnouncementController
);
serviceAnnouncementRouter.post(
  "/:id/publish",
  requireAuth,
  requireRole("admin"),
  publishServiceAnnouncementController
);

export default serviceAnnouncementRouter;
