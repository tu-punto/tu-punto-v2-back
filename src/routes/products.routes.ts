import { Request, Response, Router } from "express";
import { getProduct, registerProduct } from "../controllers/product.controller";

const productRouter = Router();
productRouter.get('/', getProduct)

productRouter.post('/register', registerProduct)

export default productRouter;