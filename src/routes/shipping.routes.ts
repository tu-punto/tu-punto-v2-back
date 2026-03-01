import { Router } from "express";
import {
  getShipping,
  registerShipping,
  registerSaleToShipping,
  ShippingController,
  getShippingByIds,
  getShippingsBySellerController,
  addTemporaryProductsToShipping,
  deleteShippingById,
  getSalesHistory,
  generateQRForShipping,
  getShippingByQR,
  resolveShippingByQRPayload,
  transitionShippingStatusByQRController,
  getShippingStatusHistoryController
} from "../controllers/shipping.controller";

const shippingRouter = Router();
//rutas
shippingRouter.get("/", getShipping);

shippingRouter.get("/:ids", getShippingByIds);

shippingRouter.post("/register", registerShipping);

shippingRouter.post("/register/sales", registerSaleToShipping);

shippingRouter.put("/:id", ShippingController.updateShipping);

shippingRouter.get("/seller/:id", getShippingsBySellerController);

shippingRouter.put("/:id/temporales", addTemporaryProductsToShipping);

shippingRouter.get("/by/:id", ShippingController.getShippingById);

shippingRouter.get("/history/sales", getSalesHistory);

shippingRouter.delete("/:id", deleteShippingById);

shippingRouter.get("/:id/qr", generateQRForShipping);

shippingRouter.get("/qr/resolve", resolveShippingByQRPayload);
shippingRouter.get("/qr/:id", getShippingByQR);
shippingRouter.patch("/qr/transition", transitionShippingStatusByQRController);
shippingRouter.get("/:id/status-history", getShippingStatusHistoryController);

export default shippingRouter;
