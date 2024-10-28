import { Router } from "express";
import { deleteProducts, getProductsByShippingId, getProductDetailsByProductId, getProductsBySellerId, getSale, registerSale, updateProducts, updateSales, deleteSales, getDataPaymentProof } from "../controllers/sale.controller";

const saleRouter = Router();

saleRouter.get('/', getSale)

saleRouter.get('/products/:id', getProductsByShippingId)

saleRouter.get('/products/seller/:id', getProductsBySellerId)

saleRouter.get('/product/:id', getProductDetailsByProductId)

saleRouter.put('/products/update/:id', updateProducts)

saleRouter.post('/register', registerSale)

saleRouter.put('/', updateSales)

saleRouter.delete('/products/delete/:id', deleteProducts)

saleRouter.delete('/', deleteSales)

saleRouter.get('/payment/:id', getDataPaymentProof )

export default saleRouter;