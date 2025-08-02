import { Document, Types } from "mongoose";
import { IVentaExterna } from "../IVentaExterna";

export interface IVentaExternaDocument extends IVentaExterna, Document {
      _id: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
}