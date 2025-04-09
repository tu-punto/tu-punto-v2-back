import { Types } from 'mongoose';

export interface IProducto {
  _id?: Types.ObjectId;
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
