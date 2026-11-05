import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { uploadContractDocument } from "../middlewares/upload.middleware";
import {
  activateContractDocument,
  createContractDocument,
  generateContract,
  generateServiceOrder,
  getSellerSendDocuments,
  getSellerContractHistory,
  getContractGenerationDownload,
  listContractDocuments,
} from "../controllers/contractDocument.controller";

const contractDocumentRouter = Router();

contractDocumentRouter.get("/", requireAuth, requireRole("admin"), listContractDocuments);
contractDocumentRouter.post("/", requireAuth, requireRole("admin"), uploadContractDocument.single("file"), createContractDocument);
contractDocumentRouter.post("/:id/activate", requireAuth, requireRole("admin"), activateContractDocument);
contractDocumentRouter.get("/seller/:id/send-documents", requireAuth, requireRole("admin", "operator"), getSellerSendDocuments);
contractDocumentRouter.get("/seller/:id/history", requireAuth, requireRole("admin", "operator"), getSellerContractHistory);
contractDocumentRouter.get("/generation/:generationId/download", requireAuth, requireRole("admin", "operator"), getContractGenerationDownload);
contractDocumentRouter.post("/seller/:id/service-order", requireAuth, requireRole("admin", "operator"), generateServiceOrder);
contractDocumentRouter.post("/seller/:id/contract", requireAuth, requireRole("admin", "operator"), generateContract);

export default contractDocumentRouter;
