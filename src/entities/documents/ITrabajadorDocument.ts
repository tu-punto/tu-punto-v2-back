import { Document, Types } from 'mongoose';
import { ITrabajador } from '../ITrabajador';

export interface ITrabajadorDocument extends ITrabajador, Document {
  _id: Types.ObjectId; 
  createdAt?: Date; 
  updatedAt?: Date; 
}
