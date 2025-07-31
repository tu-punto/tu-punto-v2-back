import { Router } from "express";
import { getFinancialSummary } from "../controllers/dashboard.controller";

const dashboardRoutes = Router();

dashboardRoutes.get("/financial-summary", getFinancialSummary);

export default dashboardRoutes;
