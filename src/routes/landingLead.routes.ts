import { Router } from "express";
import {
  createLandingLeadController,
  listLandingLeadsController,
  updateLandingLeadContactStatusController,
} from "../controllers/landingLead.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { rateLimiters } from "../middlewares/rateLimit.middleware";

const landingLeadRouter = Router();

landingLeadRouter.post("/", rateLimiters.publicReports, createLandingLeadController);
landingLeadRouter.get("/", requireAuth, requireRole("admin", "operator"), listLandingLeadsController);
landingLeadRouter.patch(
  "/:id/contact-status",
  requireAuth,
  requireRole("admin", "operator"),
  updateLandingLeadContactStatusController
);

export default landingLeadRouter;
