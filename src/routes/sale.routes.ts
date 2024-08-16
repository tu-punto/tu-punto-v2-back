import { Router } from "express";
import { deleteProducts, getProducts, getProductsBySellerId, getSale, registerSale, updateProducts } from "../controllers/sale.controller";

const saleRouter = Router();

saleRouter.get('/', getSale)

saleRouter.post('/register', registerSale)

saleRouter.get('/products/:id', getProducts)

saleRouter.get('/products/seller/:id', getProductsBySellerId)

saleRouter.put('/products/update/:id', updateProducts)

saleRouter.delete('/products/delete/:id', deleteProducts)

export default saleRouter;