import { Router } from "express";
import {
  receiveWhatsappWebhook,
  verifyWhatsappWebhook,
} from "../controllers/whatsappWebhook.controller";

const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", verifyWhatsappWebhook);
whatsappWebhookRouter.post("/", receiveWhatsappWebhook);

export default whatsappWebhookRouter;
