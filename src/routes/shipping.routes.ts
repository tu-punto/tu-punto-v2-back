import { Router } from "express";
import { getShipping, registerShipping, registerSaleToShipping, ShippingController } from "../controllers/shipping.controller";

const shippingRouter = Router();

shippingRouter.get('/', getShipping)

shippingRouter.post('/register', registerShipping)

shippingRouter.post('/register/sales', registerSaleToShipping)

shippingRouter.put('/:id', ShippingController.updateShipping)

export default shippingRouter;