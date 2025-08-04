import { Document, Types } from "mongoose";
import { IFlujoFinancieroCategoria } from "../IFlujoFinancieroCategoria";

export interface IFlujofinancieroCategoriaDocument
  extends IFlujoFinancieroCategoria,
    Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
