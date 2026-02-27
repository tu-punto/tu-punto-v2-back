import { Request, Response, Router } from "express";
import * as SellerController from '../controllers/seller.controller'

const sellerRouter = Router();

sellerRouter.get('/summary/services', SellerController.getServicesSummary);
sellerRouter.get('/clients/status', SellerController.getClientsStatusList);
sellerRouter.get('/', SellerController.getSellers);
sellerRouter.post('/register', SellerController.registerSeller);
sellerRouter.put('/update/:id', SellerController.updateSeller);
sellerRouter.get('/:id', SellerController.getSeller);
sellerRouter.put("/renew/:id", SellerController.renewSeller);
sellerRouter.post("/:id/pay", SellerController.paySellerDebt);
sellerRouter.get('/:id/debts', SellerController.getSellerDebts);
sellerRouter.get('/:id/payment-proofs', SellerController.getSellerPaymentProofs); 

export default sellerRouter;
