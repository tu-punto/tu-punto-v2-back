import { Router } from "express";
import { addFeatureToProduct, addStockToBranch, getAllProductsEntryAmountBySellerId, getFeatures, getProduct, getProductById, getProductCategory, ProductController } from "../controllers/product.controller";

const productRouter = Router();
productRouter.get('/', getProduct)

productRouter.post('/register', ProductController.registerProductVariants)

productRouter.post('/addFeatures', addFeatureToProduct)

productRouter.post('/addStock', addStockToBranch)

productRouter.get('/features/:id', getFeatures)

productRouter.get('/category/:id', getProductCategory)

productRouter.get('/:id', getProductById)

productRouter.get('/seller/:id', getAllProductsEntryAmountBySellerId)

productRouter.post('/registerVariant', ProductController.registerProduct)

productRouter.get("/:idProduct/sucursal/:idSucursal", ProductController.getProductStock)

productRouter.put('/updateStock', ProductController.updateStock)

export default productRouter;