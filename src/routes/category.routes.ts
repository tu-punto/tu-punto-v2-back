import { Router } from "express";
import { getCategory, registerCategory, getCategoryById } from "../controllers/category.controller";

const categoryRouter = Router();

categoryRouter.get('/', getCategory)

categoryRouter.post('/register', registerCategory)

categoryRouter.get('/:id', getCategoryById);

export default categoryRouter;