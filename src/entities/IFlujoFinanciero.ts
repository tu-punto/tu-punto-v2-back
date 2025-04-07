import { Types } from 'mongoose';

export interface IFlujoFinanciero {
  id_flujo_financiero: number;
  tipo: string;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: Date;
  esDeuda: boolean;

  vendedor: Types.ObjectId; 
  trabajador: Types.ObjectId; 
}
