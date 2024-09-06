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

export const deleteEntries = async (req: Request, res: Response) => {
    const { ids } = req.body;
    try {
        const deleteEntries = await EntryService.deleteEntriesByIds(ids);
        res.json({
            status: true,
            deleteEntries
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Error deleting entries', error })
    }
};

export const updateEntry = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { newData } = req.body;
    try {
        const entryUpdated = await EntryService.updateEntryById(newData, id);
        res.json(entryUpdated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Internal Server Error", error });
    }
};