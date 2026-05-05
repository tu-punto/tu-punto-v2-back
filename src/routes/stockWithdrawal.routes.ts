import { Router } from "express";
import {
  approveStockWithdrawalRequest,
  createStockWithdrawalRequest,
  listStockWithdrawalRequests,
  rejectStockWithdrawalRequest,
} from "../controllers/stockWithdrawal.controller";
import { requireRole } from "../middlewares/auth.middleware";

const stockWithdrawalRouter = Router();

stockWithdrawalRouter.get("/", requireRole("admin", "operator", "seller"), listStockWithdrawalRequests);
stockWithdrawalRouter.post("/", requireRole("seller"), createStockWithdrawalRequest);
stockWithdrawalRouter.post("/:id/approve", requireRole("admin", "operator"), approveStockWithdrawalRequest);
stockWithdrawalRouter.post("/:id/reject", requireRole("admin", "operator"), rejectStockWithdrawalRequest);

export default stockWithdrawalRouter;
