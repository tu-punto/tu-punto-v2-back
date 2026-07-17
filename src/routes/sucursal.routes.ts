import { Router } from "express";
import { getSucursalByIdController, getSucursalHeaderInfoController, registerSucursalController, SucursalController, updateSucursalController, uploadSucursalHeaderImageController } from "../controllers/sucursal.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import upload from "../config/multerConfig";


const sucursalRouter = Router()

sucursalRouter.get('/', SucursalController.getAllSucursals)
sucursalRouter.get('/basic', SucursalController.getAllSucursalsBasic)
sucursalRouter.post('/', requireAuth, requireRole("superadmin"), registerSucursalController)
sucursalRouter.put('/:id', requireAuth, requireRole("superadmin"), updateSucursalController)
sucursalRouter.post('/:id/header-image', requireAuth, requireRole("superadmin"), upload.single("imagen"), uploadSucursalHeaderImageController)
sucursalRouter.get('/:id/header-info', getSucursalHeaderInfoController)
sucursalRouter.get('/:id', getSucursalByIdController)

export default sucursalRouter
