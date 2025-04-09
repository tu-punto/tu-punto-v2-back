import { Document, Types } from 'mongoose'
import { IProducto } from '../IProducto';

export interface IProductoDocument extends IProducto, Document {
    _id: Types.ObjectId; 
    createdAt?: Date;
    updatedAt?: Date;
  }