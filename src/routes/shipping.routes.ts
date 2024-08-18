import { Router } from "express";
import { getShipping, registerShipping, registerSaleToShipping, ShippingController, getShippingByIds } from "../controllers/shipping.controller";

const shippingRouter = Router();

shippingRouter.get('/', getShipping)

shippingRouter.get('/:ids', getShippingByIds)

shippingRouter.post('/register', registerShipping)

shippingRouter.post('/register/sales', registerSaleToShipping)

shippingRouter.put('/:id', ShippingController.updateShipping)

export default shippingRouter;