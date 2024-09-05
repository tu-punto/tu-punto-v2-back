import { Request, Response } from "express";
import * as EntryService from '../services/entry.service'

export const getProductsEntryAmount = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const stock = await EntryService.getProductsEntryAmount(parseInt(id))
        res.json(stock)
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: 'Error getting entry amount by a seller Id', error });

    }
}