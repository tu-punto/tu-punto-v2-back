import { Request, Response, Router } from "express";
import { getSellers, registerSeller, updateSeller } from "../controllers/seller.controller";

const sellerRouter = Router();
sellerRouter.get('/', getSellers)

sellerRouter.post('/register', registerSeller)

sellerRouter.put('/update/:id', updateSeller)

export default sellerRouter;