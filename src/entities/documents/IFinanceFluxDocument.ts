import { Document, Types } from "mongoose";
import { IFinanceFlux } from "../IFinanceFlux";

export interface IFinanceFluxDocument extends IFinanceFlux, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
