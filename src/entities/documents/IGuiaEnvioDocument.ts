import { Document, Types } from "mongoose";
import { IGuiaEnvio } from "../IGuiaEnvio";

export interface IGuiaEnvioDocument extends IGuiaEnvio, Document {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}