import { Types } from 'mongoose';
import { ICaracteristicas } from './ICaracteristicas';

export interface ICombinacion {
  variantes: Record<string, string>; // ejemplo: { "Color": "Rojo", "Talla": "L" }
  precio: number;
  stock: number;
}

export interface ISucursalProducto {
  id_sucursal: Types.ObjectId;
  combinaciones: ICombinacion[];
}

export interface IProducto {
  _id?: Types.ObjectId;
  nombre_producto: string;
  fecha_de_ingreso: Date;
  imagen: string;
  id_categoria: Types.ObjectId;
  id_vendedor: Types.ObjectId;
  groupId: number;
  vendedor: Types.ObjectId;
  features: ICaracteristicas[];
  categoria: Types.ObjectId;
  venta: Types.ObjectId[];
  ingreso?: Types.ObjectId[];
  group: Types.ObjectId;
  sucursales: ISucursalProducto[];
  esTemporal?: boolean;
}

