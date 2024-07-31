import { Router } from "express";
import { getCategory, registerCategory } from "../controllers/category.controller";

const categoryRouter = Router();

categoryRouter.get('/', getCategory)

categoryRouter.post('/register', registerCategory)

export default categoryRouter;