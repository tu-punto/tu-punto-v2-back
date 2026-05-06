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

const externalSaleRouter = Router();

externalSaleRouter.get("/", getAllExternalSales)
externalSaleRouter.get("/list", getExternalSalesList)
externalSaleRouter.get("/contact-suggestions", getExternalContactSuggestions)
externalSaleRouter.get("/:id", getExternalSaleByID)
externalSaleRouter.post("/register", registerExternalSale)
externalSaleRouter.post("/register-packages", registerExternalSalesByPackages)
externalSaleRouter.post("/:id/send-guide-whatsapp", sendExternalGuideWhatsapp)
externalSaleRouter.delete("/:id", deleteExternalSaleByID)
externalSaleRouter.put("/update/:id", updateExternalSaleByID)

export default externalSaleRouter;
