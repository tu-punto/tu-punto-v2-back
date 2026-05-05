import { Router } from "express";
import * as SellerController from '../controllers/seller.controller'
import { requireRole, requireSellerOwnership } from "../middlewares/auth.middleware";
import upload from "../config/multerConfig";

const sellerRouter = Router();

sellerRouter.get('/summary/services', requireRole("admin"), SellerController.getServicesSummary);
sellerRouter.get('/clients/status', requireRole("admin"), SellerController.getClientsStatusList);
sellerRouter.get('/basic', requireRole("admin", "operator", "seller"), SellerController.getSellersBasic);
sellerRouter.get('/', requireRole("admin", "operator", "seller"), SellerController.getSellers);
sellerRouter.post('/register', requireRole("admin"), SellerController.registerSeller);
sellerRouter.put('/update/:id', requireRole("admin", "seller"), requireSellerOwnership("id"), SellerController.updateSeller);
sellerRouter.get('/:id', requireRole("admin", "operator", "seller"), requireSellerOwnership("id"), SellerController.getSeller);
sellerRouter.put("/renew/:id", requireRole("admin"), SellerController.renewSeller);
sellerRouter.post("/:id/payment-request", requireRole("seller"), requireSellerOwnership("id"), upload.single("qr_pago"), SellerController.requestSellerPayment);
sellerRouter.post("/:id/decline-service", requireRole("seller"), requireSellerOwnership("id"), SellerController.declineSellerService);
sellerRouter.post("/:id/pay", requireRole("admin"), SellerController.paySellerDebt);
sellerRouter.get('/:id/debts', requireRole("admin", "seller"), requireSellerOwnership("id"), SellerController.getSellerDebts);
sellerRouter.get('/:id/payment-proofs', requireRole("admin", "seller"), requireSellerOwnership("id"), SellerController.getSellerPaymentProofs); 

export default sellerRouter;
