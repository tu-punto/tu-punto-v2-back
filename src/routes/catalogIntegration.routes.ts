import { Router } from "express";
import { getCatalogSnapshot } from "../controllers/catalogIntegration.controller";
import { requireCatalogIntegrationToken } from "../middlewares/integration.middleware";

const catalogIntegrationRouter = Router();

catalogIntegrationRouter.use(requireCatalogIntegrationToken);
catalogIntegrationRouter.get("/snapshot", getCatalogSnapshot);

export default catalogIntegrationRouter;
