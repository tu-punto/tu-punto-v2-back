import { Router } from "express";
import { getShipping, registerShipping } from "../controllers/shipping.controller";

const shippingRouter = Router();

shippingRouter.get('/', getShipping)

shippingRouter.post('/register', registerShipping)

export default shippingRouter;