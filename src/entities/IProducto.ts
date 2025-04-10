import { Types } from 'mongoose';
import { ICaracteristicas } from './ICaracteristicas';

export interface IProducto {
  _id?: Types.ObjectId;
  nombre_producto: string;
  precio: number;
  fecha_de_ingreso: Date;
  imagen: string;
  id_categoria: number;
  id_vendedor: number;
  groupId: number;
  vendedor: Types.ObjectId;     
  features: ICaracteristicas[];
  categoria: Types.ObjectId;
  venta: Types.ObjectId[];             
  producto_sucursal?: Types.ObjectId[];
  ingreso?: Types.ObjectId[];
  group: Types.ObjectId;  
}
