import { Router } from "express";
import { PersonalInventoryController } from "../controllers/personalInventory.controller";

const router = Router();
router.get("/products", PersonalInventoryController.listProducts);
router.post("/products", PersonalInventoryController.createProduct);
router.patch("/products/:id", PersonalInventoryController.updateProduct);
router.post("/products/:id/stock-adjustments", PersonalInventoryController.adjustStock);
router.post("/sales", PersonalInventoryController.createSale);
router.post("/expenses", PersonalInventoryController.createExpense);
router.get("/history", PersonalInventoryController.history);
export default router;
