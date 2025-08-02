import { Router } from "express";
import { deleteExternalSaleByID, getAllExternalSales, registerExternalSale } from "../controllers/external.controller";

const externalSaleRouter = Router();

externalSaleRouter.get("/", getAllExternalSales)
externalSaleRouter.post("/register", registerExternalSale)
externalSaleRouter.delete("/:id", deleteExternalSaleByID)

export default externalSaleRouter;