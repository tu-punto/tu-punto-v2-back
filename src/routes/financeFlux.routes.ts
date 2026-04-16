import { Router } from "express";
import * as fluxController from "../controllers/financeFlux.controller";
import { getFinancialSummaryController, getCommissionController, getMerchandiseSoldController } from "../controllers/financeFlux.controller";
const financeFluxRouter = Router();

financeFluxRouter.post("/register", fluxController.registerFinanceFlux);

financeFluxRouter.patch("/:id/pay", fluxController.payDebt);

financeFluxRouter.get("/worker/:id", fluxController.getWorker);

financeFluxRouter.put("/:id", fluxController.updateFinanceFlux);

financeFluxRouter.get("/seller/:id", fluxController.getSeller);

financeFluxRouter.get("/sellerInf/:id", fluxController.getSellerInfo);

financeFluxRouter.get("/stats/", fluxController.getStatsController);

financeFluxRouter.get("/financial-summary", getFinancialSummaryController);

financeFluxRouter.get("/commission", getCommissionController);

financeFluxRouter.get("/merchandise-sold", getMerchandiseSoldController);

financeFluxRouter.get("/daily-service-income", fluxController.getDailyServiceIncome);

financeFluxRouter.get("/", fluxController.getFinanceFluxes);

export default financeFluxRouter;
