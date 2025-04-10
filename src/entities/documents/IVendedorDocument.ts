import { Document, Types } from "mongoose";
import { IVendedor } from "../IVendedor";

export interface IVendedorDocument extends IVendedor, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
