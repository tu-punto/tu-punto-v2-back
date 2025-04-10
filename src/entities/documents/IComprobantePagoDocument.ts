import { Document, Types } from 'mongoose';
import { IComprobantePago } from '../IComprobantePago';

export interface IComprobantePagoDocument extends IComprobantePago, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
