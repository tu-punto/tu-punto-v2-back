
import { Types } from 'mongoose';

export interface ICaracteristicas {
  id_caracteristicas: number;
  feature: string;
  value: string;
  product: Types.ObjectId; 
}

