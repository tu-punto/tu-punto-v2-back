import { Request, Response, Router } from "express";
import { addFeatureToProduct, getFeatures, getProduct, registerProduct } from "../controllers/product.controller";

const productRouter = Router();
productRouter.get('/', getProduct)

productRouter.post('/register', registerProduct)

productRouter.post('/addFeature', addFeatureToProduct)

productRouter.get('/features/:id', getFeatures)

export default productRouter;