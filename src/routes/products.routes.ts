import { Request, Response, Router } from "express";
import { addFeatureToProduct, getFeatures, getProduct, getProductById, getProductCategory, ProductController } from "../controllers/product.controller";

const productRouter = Router();
productRouter.get('/', getProduct)

productRouter.post('/register', ProductController.registerProductVariants)

productRouter.post('/addFeatures', addFeatureToProduct)

productRouter.get('/features/:id', getFeatures)

productRouter.get('/category/:id', getProductCategory)

productRouter.get('/:id', getProductById)

productRouter.post('/registerVariant', ProductController.registerProduct)

export default productRouter;