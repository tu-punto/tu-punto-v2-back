import { Types } from 'mongoose';

export interface IPedido {
  _id?: Types.ObjectId;

  cliente: string;
  telefono_cliente: string;
  tipo_de_pago: string;

  fecha_pedido: Date;
  hora_entrega_acordada: Date;
  hora_entrega_rango_final: Date;
  hora_entrega_real: Date;

  observaciones: string;
  lugar_origen?: Types.ObjectId; 
  lugar_entrega: string;

  costo_delivery: number;
  cargo_delivery: number;

  estado_pedido: string;
  esta_pagado: 'si' | 'no' | 'adelanto';
  adelanto_cliente: number;
  pagado_al_vendedor: boolean;

  subtotal_qr: number;
  subtotal_efectivo: number;

  trabajador?: Types.ObjectId;
  sucursal?: Types.ObjectId;

  venta: Types.ObjectId[];

  productos_temporales: [
  {
    producto: string;
    cantidad: number;
    precio_unitario: number;
    utilidad: number;
    id_vendedor: Types.ObjectId;
  }
]
}
