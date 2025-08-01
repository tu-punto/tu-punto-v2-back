import { Router } from "express";
import { registerExternalSale } from "../controllers/external.controller";

const externalSaleRouter = Router();

externalSaleRouter.post("/register", registerExternalSale)

export default externalSaleRouter;