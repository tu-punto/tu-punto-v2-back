import { Router } from "express";
import {
    deleteExternalSaleByID,
    getAllExternalSales,
    getExternalContactSuggestions,
    getExternalSalesList,
    getExternalSaleByID,
    registerExternalSale,
    registerExternalSalesByPackages,
    sendExternalGuideWhatsapp,
    updateExternalSaleByID
} from "../controllers/external.controller";
import { requireRole } from "../middlewares/auth.middleware";

const externalSaleRouter = Router();

externalSaleRouter.get("/", getAllExternalSales)
externalSaleRouter.get("/list", getExternalSalesList)
externalSaleRouter.get("/contact-suggestions", getExternalContactSuggestions)
externalSaleRouter.get("/:id", getExternalSaleByID)
externalSaleRouter.post("/register", registerExternalSale)
externalSaleRouter.post("/register-packages", registerExternalSalesByPackages)
externalSaleRouter.post("/:id/send-guide-whatsapp", requireRole("superadmin"), sendExternalGuideWhatsapp)
externalSaleRouter.delete("/:id", deleteExternalSaleByID)
externalSaleRouter.put("/update/:id", updateExternalSaleByID)

export default externalSaleRouter;
