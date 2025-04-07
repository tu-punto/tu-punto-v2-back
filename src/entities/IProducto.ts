import { Types } from 'mongoose';
import { ICaracteristicas } from "./ICaracteristicas";
import { ICategoria } from "./ICategoria";
import { IGroup } from "./IGroup";
import { IIngreso } from "./IIngreso";
import { IProducto_Sucursal } from "./IProducto_Sucursal";
import { IVendedor } from "./IVendedor";
import { IVenta } from "./IVenta";

export interface IProducto {
  id_producto: number;
  nombre_producto: string;
  precio: number;
  fecha_de_ingreso: Date;
  imagen: string;
  id_categoria: number;
  id_vendedor: number;

  vendedor: Types.ObjectId;     
  features: Types.ObjectId[];
  categoria: Types.ObjectId;
  venta: Types.ObjectId[];             
  producto_sucursal?: Types.ObjectId[];
  ingreso?: Types.ObjectId[];
  group: Types.ObjectId;  
}
