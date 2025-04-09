import { Document, Types } from 'mongoose';
import { ICierreCaja } from '../ICierreCaja';

export interface ICierreCajaDocument extends ICierreCaja, Document {
  _id: Types.ObjectId;
}
