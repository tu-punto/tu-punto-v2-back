import { Router } from "express";
import { getShipping, registerShipping, registerSaleToShipping } from "../controllers/shipping.controller";

const shippingRouter = Router();

shippingRouter.get('/', getShipping)

shippingRouter.post('/register', registerShipping)

shippingRouter.post('/register/sales', registerSaleToShipping)

export default shippingRouter;