import { Router } from "express";
import { getCategory, registerCategory, getCategoryById } from "../controllers/category.controller";
import { requireRole } from "../middlewares/auth.middleware";

const categoryRouter = Router();

categoryRouter.get('/', getCategory)

categoryRouter.post('/register', requireRole("admin"), registerCategory)

categoryRouter.get('/:id', getCategoryById);

export default categoryRouter;
