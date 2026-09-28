import { Router } from "express";
import { DynamicQRController } from "../controllers/dynamicQR.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const dynamicQRRouter = Router();

dynamicQRRouter.get("/public/:code", DynamicQRController.publicResolve);
dynamicQRRouter.get("/", requireAuth, requireRole("admin", "superadmin"), DynamicQRController.list);
dynamicQRRouter.post("/", requireAuth, requireRole("admin", "superadmin"), DynamicQRController.create);
dynamicQRRouter.patch("/:id", requireAuth, requireRole("admin", "superadmin"), DynamicQRController.update);
dynamicQRRouter.get("/:code/image", requireAuth, requireRole("admin", "superadmin"), DynamicQRController.image);

export default dynamicQRRouter;
