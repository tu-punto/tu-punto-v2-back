import { Router } from "express";
import { ProductPromotionController } from "../controllers/productPromotion.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const productPromotionRouter = Router();

productPromotionRouter.get(
  "/",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  ProductPromotionController.listPromotions
);
productPromotionRouter.get(
  "/variant-options",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  ProductPromotionController.listVariantOptions
);
productPromotionRouter.post(
  "/",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  ProductPromotionController.createPromotion
);
productPromotionRouter.post(
  "/preview",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  ProductPromotionController.previewPromotion
);
productPromotionRouter.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  ProductPromotionController.updatePromotion
);
productPromotionRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "operator", "seller"),
  ProductPromotionController.deletePromotion
);

export default productPromotionRouter;
