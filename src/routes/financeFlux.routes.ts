import { Router } from "express";
import * as fluxController from "../controllers/financeFlux.controller";

const financeFluxRouter = Router();

financeFluxRouter.get("/", fluxController.getFinanceFluxes);

financeFluxRouter.post("/register", fluxController.registerFinanceFlux);

financeFluxRouter.get("/worker/:id", fluxController.getWorker);

financeFluxRouter.get("/seller/:id", fluxController.getSeller);

financeFluxRouter.get("/sellerInf/:id", fluxController.getSellerInfo);

financeFluxRouter.get("/stats/", fluxController.getStatsController);

export default financeFluxRouter;
