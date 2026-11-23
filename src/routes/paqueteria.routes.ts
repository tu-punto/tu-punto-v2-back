import { Router } from "express";
import { checkGuideCodeAvailability, createPaqueteria, getMyPaqueteria, getPublicPaqueteriaBySlug, listPaqueterias, updatePaqueteria, uploadPaqueteriaLogo } from "../controllers/paqueteria.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import upload from "../config/multerConfig";

const router = Router();
router.get("/me", requireAuth, requireRole("paqueteria"), getMyPaqueteria);
router.get("/public/:slug", getPublicPaqueteriaBySlug);
router.get("/guide-code-availability", requireAuth, requireRole("admin"), checkGuideCodeAvailability);
router.get("/", requireAuth, requireRole("admin"), listPaqueterias);
router.post("/", requireAuth, requireRole("admin"), createPaqueteria);
router.put("/:id", requireAuth, requireRole("admin"), updatePaqueteria);
router.post("/:id/logo", requireAuth, requireRole("admin"), upload.single("logo"), uploadPaqueteriaLogo);
export default router;
