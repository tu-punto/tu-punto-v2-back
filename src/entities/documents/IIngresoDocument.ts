import { Document, Types } from "mongoose";
import { IIngreso } from "../IIngreso";

export interface IIngresoDocument extends IIngreso, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}