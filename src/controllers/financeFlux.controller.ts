import { Request, Response } from "express"
import { FinanceFluxService } from "../services/financeFlux.service"

export const getFinanceFluxes = async (req: Request, res: Response) => {
    try {
        const financeFluxes = await FinanceFluxService.getAllFinanceFluxes()
        res.json(financeFluxes)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
}

export const registerFinanceFlux = async (req: Request, res: Response) => {
    const financeFlux = req.body
    try {
        const newFinanceFlux = await FinanceFluxService.registerFinanceFlux(financeFlux)
        res.json({
            status: true,
            newFinanceFlux
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'Internal Server Error', error })
    }
}