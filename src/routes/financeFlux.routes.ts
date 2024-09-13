import { Router } from "express";
import { getFinanceFluxes, getSeller, getSellerInfo, getWorker, registerFinanceFlux } from "../controllers/financeFlux.controller";

const financeFluxRouter = Router()

financeFluxRouter.get('/', getFinanceFluxes)

financeFluxRouter.post('/register', registerFinanceFlux)

financeFluxRouter.get('/worker/:id', getWorker)

financeFluxRouter.get('/seller/:id', getSeller)

financeFluxRouter.get('/sellerInf/:id', getSellerInfo)



export default financeFluxRouter

