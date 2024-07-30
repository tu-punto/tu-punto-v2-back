import { Router } from "express";
import { getProducts, getSale, registerSale } from "../controllers/sale.controller";

const saleRouter = Router();

saleRouter.get('/', getSale)

saleRouter.post('/register', registerSale)

saleRouter.get('/products/:id', getProducts)

export default saleRouter;