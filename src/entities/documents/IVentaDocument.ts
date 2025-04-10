import { Document, Types } from 'mongoose';
import { IVenta } from '../IVenta';

export interface IVentaDocument extends IVenta, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
