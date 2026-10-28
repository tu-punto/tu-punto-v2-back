import { Router } from "express";
import { getTermsDocumentController, replaceTermsDocumentController } from "../controllers/termsDocument.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { uploadTermsDocument } from "../middlewares/upload.middleware";

const termsDocumentRouter = Router();
termsDocumentRouter.get("/", requireAuth, requireRole("superadmin"), getTermsDocumentController);
termsDocumentRouter.put("/", requireAuth, requireRole("superadmin"), uploadTermsDocument.single("file"), replaceTermsDocumentController);
export default termsDocumentRouter;
