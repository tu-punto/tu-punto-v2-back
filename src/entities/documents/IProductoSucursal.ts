import { Document, Types } from 'mongoose';
import { IProducto_Sucursal } from '../IProducto_Sucursal';

export interface IProductoSucursalDocument extends IProducto_Sucursal, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
