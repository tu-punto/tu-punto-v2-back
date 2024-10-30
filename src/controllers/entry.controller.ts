import { Request, Response } from "express";
import * as EntryService from '../services/entry.service'

export const getProductsEntryAmount = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const stock = await EntryService.getProductsEntryAmount(parseInt(id))
        res.json(stock)
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: 'Error getting entry amount by a seller Id', error });

    }
}

export const getProductEntryDetails = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const stock = await EntryService.getProductEntryDetails(parseInt(id))
        res.json(stock)
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: 'Error getting entry amount by a product Id', error });

    }
}

export const deleteEntries = async (req: Request, res: Response) => {
    const entries = req.body.entries;
    try {
        const entryIds = entries.map((entry: { id_ingreso: number }) => entry.id_ingreso);
        const deletedEntries = await EntryService.deleteEntriesByIds(entryIds);
        res.json({
            status: true,
            message: 'Entries deleted successfully',
            data: deletedEntries
        })

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error deleting entries', error })
    }
};

export const deleteEntriesOfProducts = async (req: Request, res: Response) => {
    const entryData = req.body;
    try {
      const deletedEntries = await EntryService.deleteProductEntries(entryData);
      res.json({
        status: true,
        deletedEntries,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: "Error deleting entries", error });
    }
  };

export const updateEntry = async (req: Request, res: Response) => {
    const entries = req.body.entries
    try {
        const entryUpdated = await EntryService.updateEntries(entries);
        res.status(200).json({
            status: "success",
            message: `${entryUpdated.length} entries updated successfully`,
            data: entryUpdated
          });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Error updating entries", error });
    }
};

export const updateEntriesOfProducts = async (req: Request, res: Response) => {
    const entryData = req.body;
    try {
      const updatedEntries = await EntryService.updateProductEntries(entryData);
      res.json({
        status: true,
        updatedEntries,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: "Error updating entries", error });
    }
  };