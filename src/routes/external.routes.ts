import { Router } from "express";
import {
    deleteExternalSaleByID,
    getAllExternalSales,
    getExternalSaleByID,
    registerExternalSale,
    registerExternalSalesByPackages,
    updateExternalSaleByID
} from "../controllers/external.controller";

const externalSaleRouter = Router();

externalSaleRouter.get("/", getAllExternalSales)
externalSaleRouter.get("/:id", getExternalSaleByID)
externalSaleRouter.post("/register", registerExternalSale)
externalSaleRouter.post("/register-packages", registerExternalSalesByPackages)
externalSaleRouter.delete("/:id", deleteExternalSaleByID)
externalSaleRouter.put("/update/:id", updateExternalSaleByID)

export default externalSaleRouter;
