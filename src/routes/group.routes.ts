import { Router } from "express";
import { GroupController } from "../controllers/group.controller";
import { requireRole } from "../middlewares/auth.middleware";


const groupRouter = Router()

groupRouter.get('/:id/variants', GroupController.getProductsInGroup)

groupRouter.get('/', GroupController.getAllGroups)

groupRouter.put('/products/:id', requireRole("admin"), GroupController.updateGroupAndProductNames)

groupRouter.get('/:id', GroupController.getGroupById)

export default groupRouter
