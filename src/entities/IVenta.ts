import { Types } from 'mongoose';
import { IProducto } from './IProducto';
import { IPedido } from './IPedido';
import { IVendedor } from './IVendedor';

export interface IVenta {
  _id?: Types.ObjectId;
  id_producto: Types.ObjectId;
  id_pedido: Types.ObjectId;
  id_vendedor: Types.ObjectId;
  cantidad: number;
  precio_unitario: number;
  utilidad: number;
  deposito_realizado: boolean;

  producto: IProducto;
  pedido: IPedido;
  vendedor: IVendedor;
  sucursal: Types.ObjectId; // Referencia a la sucursal
  quien_paga_delivery?: 'comprador' | 'vendedor' | 'tupunto';
  nombre_variante?: string;

  comision: number;
  fecha: Date;
}
