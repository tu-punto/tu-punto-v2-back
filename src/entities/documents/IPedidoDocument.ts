
import { Document, Types } from "mongoose";
import { IPedido } from "../IPedido";

export interface IPedidoDocument extends IPedido, Document {
      _id: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
}
