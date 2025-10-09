import { Router } from "express";
import { deleteExternalSaleByID, getAllExternalSales, registerExternalSale, updateExternalSaleByID } from "../controllers/external.controller";

const externalSaleRouter = Router();

externalSaleRouter.get("/", getAllExternalSales)
externalSaleRouter.post("/register", registerExternalSale)
externalSaleRouter.delete("/:id", deleteExternalSaleByID)
externalSaleRouter.put("/update/:id", updateExternalSaleByID)

export default externalSaleRouter;