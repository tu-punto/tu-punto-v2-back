import { Router } from "express";
import { ProductPromotionController } from "../controllers/productPromotion.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const productPromotionRouter = Router();

productPromotionRouter.get(
  "/",
  requireAuth,
  requireRole("seller"),
  ProductPromotionController.listPromotions
);
productPromotionRouter.get(
  "/variant-options",
  requireAuth,
  requireRole("seller"),
  ProductPromotionController.listVariantOptions
);
productPromotionRouter.post(
  "/",
  requireAuth,
  requireRole("seller"),
  ProductPromotionController.createPromotion
);
productPromotionRouter.post(
  "/preview",
  requireAuth,
  requireRole("seller"),
  ProductPromotionController.previewPromotion
);
productPromotionRouter.patch(
  "/:id",
  requireAuth,
  requireRole("seller"),
  ProductPromotionController.updatePromotion
);
productPromotionRouter.delete(
  "/:id",
  requireAuth,
  requireRole("seller"),
  ProductPromotionController.deletePromotion
);

export default productPromotionRouter;
