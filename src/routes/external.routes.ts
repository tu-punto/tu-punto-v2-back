import { Router } from "express";
import {
    ExternalController,
} from "../controllers/external.controller";
import { requireRole } from "../middlewares/auth.middleware";

const externalSaleRouter = Router();

externalSaleRouter.get("/", ExternalController.getAllExternalSales)
externalSaleRouter.get("/list", ExternalController.getExternalSalesList)
externalSaleRouter.get("/contact-suggestions", ExternalController.getExternalContactSuggestions)
externalSaleRouter.get("/:id", ExternalController.getExternalSaleByID)
externalSaleRouter.post("/register", ExternalController.registerExternalSale)
externalSaleRouter.post("/register-packages", ExternalController.registerExternalSalesByPackages)
externalSaleRouter.get("/:id/send-guide-whatsapp/preview", requireRole("superadmin"), ExternalController.previewExternalGuideWhatsapp)
externalSaleRouter.post("/:id/send-guide-whatsapp", requireRole("superadmin"), ExternalController.sendExternalGuideWhatsapp)
externalSaleRouter.post("/:id/anular", requireRole("admin", "operator", "superadmin"), ExternalController.annulExternalSaleByID)
externalSaleRouter.delete("/:id", ExternalController.deleteExternalSaleByID)
externalSaleRouter.put("/update/:id", ExternalController.updateExternalSaleByID)

export default externalSaleRouter;
