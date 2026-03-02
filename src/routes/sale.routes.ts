import { Router } from "express";
import { deleteSalesOfProducts, deleteProducts, getProductsByShippingId, getProductDetailsByProductId, getProductsBySellerId, getSale, registerSale, updateProducts, updateSales, deleteSales, getDataPaymentProof, updateSalesOfProducts, updateSaleById, deleteSaleById } from "../controllers/sale.controller";
import { requireSellerOwnership } from "../middlewares/auth.middleware";

const saleRouter = Router();

saleRouter.get('/', getSale)

saleRouter.get('/products/:id', getProductsByShippingId)

saleRouter.get('/products/seller/:id', requireSellerOwnership("id"), getProductsBySellerId)

saleRouter.get('/product/:id', getProductDetailsByProductId)

saleRouter.put('/products/update/:id', updateProducts)

saleRouter.post('/register', registerSale)

saleRouter.put('/', updateSales)

saleRouter.put('/products/', updateSalesOfProducts)

saleRouter.delete('/products/delete/:id', deleteProducts)

saleRouter.delete('/', deleteSales)

saleRouter.delete('/products/', deleteSalesOfProducts)

saleRouter.get('/payment/:id', requireSellerOwnership("id"), getDataPaymentProof )

saleRouter.put('/:id', updateSaleById);

saleRouter.delete('/:id', deleteSaleById);

export default saleRouter;
