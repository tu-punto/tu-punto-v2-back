import { Router } from "express";

import * as EntryController from '../controllers/entry.controller'

const entryRouter = Router();

entryRouter.get('/seller/:id', EntryController.getProductsEntryAmount);

entryRouter.get('/product/:id', EntryController.getProductEntryDetails);

entryRouter.delete('/', EntryController.deleteEntries)

entryRouter.delete('/products/', EntryController.deleteEntriesOfProducts)

entryRouter.put('/', EntryController.updateEntry);

entryRouter.put('/products/', EntryController.updateEntriesOfProducts);

entryRouter.post('/', EntryController.createEntry); //This is just to create one entry

export default entryRouter;