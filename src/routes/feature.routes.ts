import { Router } from "express";
import { getFeature, registerFeature } from "../controllers/feature.controller";

const featureRouter = Router();

featureRouter.get('/', getFeature)

featureRouter.post('/register', registerFeature)

export default featureRouter;