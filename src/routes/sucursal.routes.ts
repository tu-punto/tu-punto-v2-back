import { Router } from "express";
import { getSucursalByIdController, registerSucursalController, SucursalController, updateSucursalController } from "../controllers/sucursal.controller";


const sucursalRouter = Router()

sucursalRouter.get('/', SucursalController.getAllSucursals)
sucursalRouter.post('/', registerSucursalController)
sucursalRouter.put('/:id', updateSucursalController)
sucursalRouter.get('/:id', getSucursalByIdController)

export default sucursalRouter