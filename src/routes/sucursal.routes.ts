import { Router } from "express";
import { getSucursalByIdController, registerSucursalController, SucursalController, updateSucursalController } from "../controllers/sucursal.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";


const sucursalRouter = Router()

sucursalRouter.get('/', SucursalController.getAllSucursals)
sucursalRouter.post('/', requireAuth, requireRole("admin"), registerSucursalController)
sucursalRouter.put('/:id', requireAuth, requireRole("admin"), updateSucursalController)
sucursalRouter.get('/:id', getSucursalByIdController)

export default sucursalRouter
