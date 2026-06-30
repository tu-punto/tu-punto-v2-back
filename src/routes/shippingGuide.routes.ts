import { Router } from "express";
import { getAllShippings, getBranchShippings, getSellerShippings, markAsDelivered, uploadShipping } from "../controllers/shippingGuide.controller";
import { uploadGuideImage } from '../config/multerConfig'
import { requireRole, requireSellerOwnership } from "../middlewares/auth.middleware";


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

shippingGuideRouter.get("/", requireRole("admin", "operator"), getAllShippings)
shippingGuideRouter.get('/seller/:id', requireRole("admin", "operator", "seller"), requireSellerOwnership("id"), getSellerShippings)
shippingGuideRouter.get('/branch/:id', requireRole("admin", "operator"), getBranchShippings)
shippingGuideRouter.post("/upload", requireRole("admin", "operator", "seller"), uploadGuideImageSingle, uploadShipping)
shippingGuideRouter.put("/mark-deliver/:id", requireRole("admin", "operator", "seller"), markAsDelivered)

export default shippingGuideRouter;
