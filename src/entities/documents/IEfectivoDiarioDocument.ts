
import { Document, Types } from "mongoose";
import { IEfectivoDiario } from "../IEfectivoDiario";

export interface IEfectivoDiarioDocument extends IEfectivoDiario, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
