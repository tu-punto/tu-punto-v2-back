import { Router } from "express";
import { getCategory, registerCategory, getCategoryById, updateCategory } from "../controllers/category.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import upload from "../config/multerConfig";

const categoryRouter = Router();

categoryRouter.get('/', getCategory)

categoryRouter.post('/register', requireAuth, requireRole("superadmin"), registerCategory)
categoryRouter.put('/:id', requireAuth, requireRole("superadmin"), upload.single("imagen"), updateCategory)

categoryRouter.get('/:id', getCategoryById);

export default categoryRouter;
