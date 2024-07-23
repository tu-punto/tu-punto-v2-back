import { Router } from "express";
import { GroupController } from "../controllers/group.controller";


const groupRouter = Router()

groupRouter.get('/:id/variants', GroupController.getProductsInGroup)

export default groupRouter