import { Request, Response } from "express"
import { FinanceFluxService } from "../services/financeFlux.service"

export const getFinanceFluxes = async (req: Request, res: Response) => {
    try {
        const financeFluxes = await FinanceFluxService.getAllFinanceFluxes();
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
export const getWorker = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id)
    try {
        const worker = await FinanceFluxService.getWorkerById(id)
        res.json(worker)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener un trabajador' });

    }
}
export const getSeller = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id)
    try {
        const seller = await FinanceFluxService.getSellerById(id)
        res.json(seller)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener un vendedor' });

    }
}