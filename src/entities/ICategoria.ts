import { Types } from 'mongoose';
import { IProducto } from './IProducto';

export interface ICategoria {
 
  categoria: string;
  imagen_catalogo_url?: string;

  producto?: Types.ObjectId[] | IProducto[]; 
}
