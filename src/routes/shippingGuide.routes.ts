import { Router } from "express";
import { getAllShippings, getBranchShippings, getSellerShippings, markAsDelivered, uploadShipping } from "../controllers/shippingGuide.controller";
import upload from '../config/multerConfig'
import { requireRole, requireSellerOwnership } from "../middlewares/auth.middleware";


const shippingGuideRouter = Router();

shippingGuideRouter.get("/", requireRole("admin", "operator"), getAllShippings)
shippingGuideRouter.get('/seller/:id', requireRole("admin", "operator", "seller"), requireSellerOwnership("id"), getSellerShippings)
shippingGuideRouter.get('/branch/:id', requireRole("admin", "operator"), getBranchShippings)
shippingGuideRouter.post("/upload", requireRole("admin", "operator", "seller"), upload.single('imagen'), uploadShipping)
shippingGuideRouter.put("/mark-deliver/:id", requireRole("admin", "operator", "seller"), markAsDelivered)

export default shippingGuideRouter;
