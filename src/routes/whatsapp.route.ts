import { Router } from "express";
import { sendHello, sendWhats } from "../controllers/whatsapp.controller";

const whatsRouter = Router();

whatsRouter.post('/sendMessage', sendWhats)
whatsRouter.post('/sendHello', sendHello)

export default whatsRouter