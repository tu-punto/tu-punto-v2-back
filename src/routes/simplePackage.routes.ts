import { Router } from "express";
import {
  createSimplePackageOrders,
  deleteSimplePackageByID,
  getPackageEscalationConfig,
  getSimplePackageBranchPrices,
  getSimplePackageEscalationStatus,
  getSimplePackagesList,
  getSellerAccountingSimplePackages,
  getUploadedSimplePackageSellers,
  printSimplePackageGuidesController,
  registerSimplePackages,
  sendSimplePackageGuideWhatsappController,
  upsertPackageEscalationConfig,
  upsertSimplePackageBranchPrice,
  updateSimplePackageByID,
} from "../controllers/simplePackage.controller";
import { requireRole } from "../middlewares/auth.middleware";

const simplePackageRouter = Router();

simplePackageRouter.get("/list", getSimplePackagesList);
simplePackageRouter.get("/uploaded-sellers", getUploadedSimplePackageSellers);
simplePackageRouter.get("/seller-accounting", getSellerAccountingSimplePackages);
simplePackageRouter.get("/branch-prices", getSimplePackageBranchPrices);
simplePackageRouter.get("/escalation-config", getPackageEscalationConfig);
simplePackageRouter.get("/escalation-status", getSimplePackageEscalationStatus);
simplePackageRouter.post("/register", registerSimplePackages);
simplePackageRouter.post("/print-guides", printSimplePackageGuidesController);
simplePackageRouter.post("/send-guide-whatsapp", requireRole("superadmin"), sendSimplePackageGuideWhatsappController);
simplePackageRouter.post("/create-orders", createSimplePackageOrders);
simplePackageRouter.post("/branch-prices", upsertSimplePackageBranchPrice);
simplePackageRouter.post("/escalation-config", upsertPackageEscalationConfig);
simplePackageRouter.put("/:id", updateSimplePackageByID);
simplePackageRouter.delete("/:id", deleteSimplePackageByID);

export default simplePackageRouter;
