import { Router } from "express";
import {
  getShipping,
  getShippingDashboardList,
  getShippingList,
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
  getShippingStatusHistoryController,
  markSellerWithdrawalController
  ,rejectCatalogOrderController
} from "../controllers/shipping.controller";
import { requireRole, requireSellerOwnership } from "../middlewares/auth.middleware";

const shippingRouter = Router();
shippingRouter.use((req, res, next) => {
  if (String(res.locals.auth?.role || "").toLowerCase() !== "farmer") return next();
  const allowed = req.method === "POST" && ["/register", "/register/sales"].includes(req.path);
  if (!allowed) return res.status(403).json({ success: false, msg: "El granjero solo puede registrar entregas desde carrito" });
  return next();
});
//rutas
shippingRouter.get("/", getShipping);
shippingRouter.get("/dashboard", getShippingDashboardList);
shippingRouter.get("/list", getShippingList);

shippingRouter.get("/:ids", getShippingByIds);

shippingRouter.post("/register", registerShipping);

shippingRouter.post("/register/sales", registerSaleToShipping);

shippingRouter.post("/seller-withdrawal", markSellerWithdrawalController);
shippingRouter.post("/:id/reject-catalog", requireRole("admin", "operator", "superadmin"), rejectCatalogOrderController);

shippingRouter.put("/:id", ShippingController.updateShipping);

shippingRouter.get("/seller/:id", requireSellerOwnership("id"), getShippingsBySellerController);

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
