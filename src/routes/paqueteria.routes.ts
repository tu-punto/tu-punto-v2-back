import { Router } from "express";
import { createPaqueteria, getMyPaqueteria, listPaqueterias, updatePaqueteria } from "../controllers/paqueteria.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();
router.get("/me", requireAuth, requireRole("paqueteria"), getMyPaqueteria);
router.get("/", requireAuth, requireRole("admin"), listPaqueterias);
router.post("/", requireAuth, requireRole("admin"), createPaqueteria);
router.put("/:id", requireAuth, requireRole("admin"), updatePaqueteria);
export default router;
