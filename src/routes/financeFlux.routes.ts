import { Router } from "express";
import { getFinanceFluxes, registerFinanceFlux } from "../controllers/financeFlux.controller";

const financeFluxRouter = Router()

financeFluxRouter.get('/', getFinanceFluxes)

financeFluxRouter.post('/register', registerFinanceFlux)

export default financeFluxRouter

