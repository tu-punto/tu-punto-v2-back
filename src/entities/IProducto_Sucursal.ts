import { Types } from 'mongoose';
import { IProducto } from "./IProducto";
import { ISucursal } from "./ISucursal";

export interface IProducto_Sucursal {
  _id?: Types.ObjectId;
  id_producto: number;
  id_sucursal: number;
  cantidad_por_sucursal: number;
  numero_caja: number;

  producto: Types.ObjectId; 
  sucursal: Types.ObjectId; 
}
