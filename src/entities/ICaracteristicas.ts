
import { Types } from 'mongoose';

export interface ICaracteristicas {
  feature: string;
  value: string;
  product: Types.ObjectId; 
}

