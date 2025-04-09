import { Types } from 'mongoose';

export interface IEfectivoDiario {
  _id?: Types.ObjectId;
  corte_0_2: number;
  corte_0_5: number;
  corte_1: number;
  corte_2: number;
  corte_5: number;
  corte_10: number;
  corte_20: number;
  corte_50: number;
  corte_100: number;
  corte_200: number;
  total_coins: number;
  total_bills: number;
  created_at: Date;
  updated_at: Date;
  id_cierre_caja: Types.ObjectId; 
}
