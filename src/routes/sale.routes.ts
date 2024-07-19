import { Router } from "express";
import { getSale, registerSale } from "../controllers/sale.controller";

const saleRouter = Router();

saleRouter.get('/', getSale)

saleRouter.post('/register', registerSale)

export default saleRouter;