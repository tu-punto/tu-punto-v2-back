import { Router } from "express";
import { getAllShippings, getSellerShippings, uploadShipping } from "../controllers/shippingGuide.controller";


const shippingGuideRouter = Router();

shippingGuideRouter.get("/",getAllShippings)
shippingGuideRouter.get("/seller",getSellerShippings)
shippingGuideRouter.post("/upload",uploadShipping)

export default shippingGuideRouter;