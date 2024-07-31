import { Router } from "express";
import { SucursalController } from "../controllers/sucursal.controller";


const sucursalRouter = Router()

sucursalRouter.get('/', SucursalController.getAllSucursals)

export default sucursalRouter