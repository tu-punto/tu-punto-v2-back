import { Router } from "express";
import { pdfController } from "../controllers/pdf.controller";

const pdfRouter = Router();
//PDF
pdfRouter.post('/productsDeliveried', pdfController.uploadPDF)
pdfRouter.post('/payment/:id', pdfController.uploadPaymentPDF)

export default pdfRouter
