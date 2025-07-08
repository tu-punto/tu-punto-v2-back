import { Types } from 'mongoose';
import { ITrabajador } from './ITrabajador';
import { IVendedor } from './IVendedor';
import { ISucursal } from './ISucursal';

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
  id_sucursal?: Types.ObjectId | ISucursal;
}
