import { Types } from 'mongoose';
import { ITrabajador } from './ITrabajador';
import { IVendedor } from './IVendedor';

export interface IFlujoFinanciero {
  tipo: string;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: Date;
  esDeuda: boolean;

  vendedor?: Types.ObjectId | IVendedor; 
  id_vendedor?: Types.ObjectId;
  trabajador?: Types.ObjectId | ITrabajador;
}
