import { Router } from "express";
import { deleteProducts, getProducts, getProductsBySellerId, getSale, registerSale, updateProducts, updateSale, deleteSales } from "../controllers/sale.controller";

const saleRouter = Router();

saleRouter.get('/', getSale)

saleRouter.post('/register', registerSale)

saleRouter.get('/products/:id', getProducts)

saleRouter.get('/products/seller/:id', getProductsBySellerId)

saleRouter.put('/products/update/:id', updateProducts)

saleRouter.put('/:id', updateSale)

saleRouter.delete('/products/delete/:id', deleteProducts)

saleRouter.delete('/delete', deleteSales)

export default saleRouter;