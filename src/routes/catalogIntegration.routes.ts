import { Router } from "express";
import { createCatalogOrder, getCatalogSnapshot } from "../controllers/catalogIntegration.controller";
import { requireCatalogIntegrationToken } from "../middlewares/integration.middleware";

const catalogIntegrationRouter = Router();

catalogIntegrationRouter.use(requireCatalogIntegrationToken);
catalogIntegrationRouter.get("/snapshot", getCatalogSnapshot);
catalogIntegrationRouter.post("/orders", createCatalogOrder);

export default catalogIntegrationRouter;
