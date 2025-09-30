import { Router } from "express";
import { getAllShippings, getSellerShippings, markAsDelivered, uploadShipping } from "../controllers/shippingGuide.controller";
import upload from '../config/multerConfig'


const shippingGuideRouter = Router();

shippingGuideRouter.get("/",getAllShippings)
shippingGuideRouter.get('/seller/:id',getSellerShippings)
shippingGuideRouter.post("/upload",upload.single('imagen'),uploadShipping)
shippingGuideRouter.put("/mark-deliver/:id", markAsDelivered)

export default shippingGuideRouter;