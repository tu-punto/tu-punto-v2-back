import { Router } from "express";
import { createFarmerDiscountRule, deleteFarmerDiscountRule, listFarmerDiscountRules, updateFarmerDiscountRule } from "../controllers/farmerDiscountRule.controller";
const router = Router();
router.get("/", listFarmerDiscountRules);
router.post("/", createFarmerDiscountRule);
router.put("/:id", updateFarmerDiscountRule);
router.delete("/:id", deleteFarmerDiscountRule);
export default router;
