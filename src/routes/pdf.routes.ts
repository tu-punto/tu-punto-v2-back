import { Router } from "express";
import { pdfController } from "../controllers/pdf.controller";

const pdfRouter = Router();

pdfRouter.post('/productsDeliveried', pdfController.uploadPDF)

export default pdfRouter