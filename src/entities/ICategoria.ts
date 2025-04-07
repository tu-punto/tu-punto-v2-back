import { Types } from 'mongoose';

export interface ICategoria {
  id_categoria: number;
  categoria: string;

  producto?: Types.ObjectId[]; 
}
