import { Request, Response } from "express";
import { ExternalSaleService } from "../services/external.service";

export const registerExternalSale = async (req: Request, res: Response) => {
    const externalSale = req.body;
    try {
        const newExternalSale = await ExternalSaleService.registerExternalSale(externalSale);
        res.json({
            status: true,
            newExternalSale,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Internal Server Error"});
    }
}