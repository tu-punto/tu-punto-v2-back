import { Document, Types } from "mongoose";
import { ICaracteristicas } from "../ICaracteristicas";

export interface ICaracteristicasDocument extends ICaracteristicas, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
