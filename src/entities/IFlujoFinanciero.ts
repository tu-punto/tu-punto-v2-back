import { Types } from 'mongoose';

export interface IFlujoFinanciero {
  tipo: string;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: Date;
  esDeuda: boolean;

  vendedor: Types.ObjectId; 
  trabajador: Types.ObjectId; 
}
