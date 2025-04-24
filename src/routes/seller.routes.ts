import { Request, Response, Router } from "express";
import * as SellerController from '../controllers/seller.controller'

const sellerRouter = Router();
sellerRouter.get('/', SellerController.getSellers)

sellerRouter.post('/register', SellerController.registerSeller)

sellerRouter.put('/update/:id', SellerController.updateSeller)

sellerRouter.get('/:id', SellerController.getSeller)

sellerRouter.put("/renew/:id", SellerController.updateSeller);

export default sellerRouter;