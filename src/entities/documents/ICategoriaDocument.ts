import { Document, Types } from 'mongoose';
import { ICategoria } from '../ICategoria'; 
export interface ICategoriaDocument extends ICategoria, Document {
  _id: Types.ObjectId; 
}

