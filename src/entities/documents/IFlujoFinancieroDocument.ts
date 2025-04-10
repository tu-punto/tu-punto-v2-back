import { Document, Types } from 'mongoose';
import { IFlujoFinanciero } from '../IFlujoFinanciero';

export interface IFlujoFinancieroDocument extends IFlujoFinanciero, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
