import { Router } from "express";
import { getFeature, registerFeature } from "../controllers/feature.controller";
import { requireRole } from "../middlewares/auth.middleware";

const featureRouter = Router();

featureRouter.get('/', getFeature)

featureRouter.post('/register', requireRole("admin"), registerFeature)

export default featureRouter;
