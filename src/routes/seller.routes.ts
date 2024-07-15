import { Request, Response, Router } from "express";
import { getSellers, registerSeller } from "../controllers/seller.controller";

const sellerRouter = Router();
sellerRouter.get('/', getSellers)

sellerRouter.post('/register', registerSeller)

export default sellerRouter;