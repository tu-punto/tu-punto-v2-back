import { Types } from 'mongoose';
import { ICaracteristicas } from './ICaracteristicas';

export interface ISubvariante {
  nombre_subvariante: string;
  precio: number;
  stock: number;
}

export interface IVariante {
  nombre_variante: string;
  precio?: number;
  stock?: number;
  subvariantes?: ISubvariante[];
}

export interface ISucursalProducto {
  id_sucursal: Types.ObjectId;
  variantes: IVariante[];
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
}
