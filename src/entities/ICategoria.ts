import { Types } from 'mongoose';
import { IProducto } from './IProducto';

export interface ICategoria {
 
  categoria: string;

  producto?: Types.ObjectId[] | IProducto[]; 
}
