import { Router } from "express";
import { pdfController } from "../controllers/pdf.controller";

const pdfRouter = Router();

pdfRouter.post('/productsDeliveried', pdfController.uploadPDF)
pdfRouter.post('/payment', pdfController.uploadPaymentPDF)

export default pdfRouter