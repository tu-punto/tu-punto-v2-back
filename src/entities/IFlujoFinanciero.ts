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
  visible_en_flujo_general?: boolean;
  clase_cobro?: "INGRESO" | "RECUPERACION";
  descuento_porcentaje?: number;
  monto_sin_descuento?: number;
  attachment_url?: string;
  attachment_key?: string;
  attachment_name?: string;
  attachment_type?: string;
  detalle_servicios?: {
    id_sucursal?: Types.ObjectId | ISucursal;
    sucursalName: string;
    alquiler: number;
    exhibicion: number;
    entrega_simple: number;
    delivery: number;
    total: number;
  }[];
  founder?: string;

  vendedor?: Types.ObjectId | IVendedor; 
  id_vendedor?: Types.ObjectId;
  trabajador?: Types.ObjectId | ITrabajador;
  id_sucursal?: Types.ObjectId | ISucursal;
}
