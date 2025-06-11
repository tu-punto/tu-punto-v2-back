import { Router } from "express";
import {
  getShipping,
  registerShipping,
  registerSaleToShipping,
  ShippingController,
  getShippingByIds,
  getShippingsBySellerController,
  addTemporaryProductsToShipping,
  deleteShippingById
} from "../controllers/shipping.controller";

const shippingRouter = Router();

shippingRouter.get("/", getShipping);

shippingRouter.get("/:ids", getShippingByIds);

shippingRouter.post("/register", registerShipping);

shippingRouter.post("/register/sales", registerSaleToShipping);

shippingRouter.put("/:id", ShippingController.updateShipping);

shippingRouter.get("/seller/:id", getShippingsBySellerController);

shippingRouter.put("/:id/temporales", addTemporaryProductsToShipping);

shippingRouter.get("/by/:id", ShippingController.getShippingById);

shippingRouter.delete("/:id", deleteShippingById);

export default shippingRouter;
