import { Router } from "express";
import { getAllShippings, getBranchShippings, getSellerShippings, markAsDelivered, uploadShipping } from "../controllers/shippingGuide.controller";
import { imageMimeTypes, uploadGuideImage } from "../config/multerConfig";
import { requireRole, requireSellerOwnership } from "../middlewares/auth.middleware";
import { rateLimiters } from "../middlewares/rateLimit.middleware";
import { validateRequest } from "../middlewares/validate.middleware";
import { validateUploadedFiles } from "../middlewares/upload.middleware";
import { validateShippingGuideBody } from "../validation/uploads.validation";


const shippingGuideRouter = Router();
const uploadGuideImageSingle = (req: any, res: any, next: any) => {
  uploadGuideImage.single("imagen")(req, res, (error: any) => {
    if (!error) return next();
    const message =
      error?.code === "LIMIT_FILE_SIZE"
        ? "La imagen de la guia no puede superar 15 MB"
        : error?.message || "No se pudo procesar la imagen";
    return res.status(400).json({ success: false, message });
  });
};

shippingGuideRouter.get("/", requireRole("admin", "operator", "superadmin"), getAllShippings)
shippingGuideRouter.get('/seller/:id', requireRole("admin", "operator", "seller"), requireSellerOwnership("id"), getSellerShippings)
shippingGuideRouter.get('/branch/:id', requireRole("admin", "operator", "superadmin"), getBranchShippings)
shippingGuideRouter.post(
  "/upload",
  requireRole("admin", "operator", "seller", "superadmin"),
  rateLimiters.uploads,
  uploadGuideImageSingle,
  validateUploadedFiles({ fieldLabel: "guia", allowedMimeTypes: imageMimeTypes }),
  validateRequest({
    body: (input, _req, res) =>
      validateShippingGuideBody(input, String(res.locals.auth?.role || ""), String(res.locals.auth?.sellerId || "")),
  }),
  uploadShipping
)
shippingGuideRouter.put("/mark-deliver/:id", requireRole("admin", "operator", "superadmin", "seller"), markAsDelivered)

export default shippingGuideRouter;
