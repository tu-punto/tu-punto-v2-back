import { Types } from 'mongoose';

export interface IPedido {
  _id?: Types.ObjectId;

  cliente: string;
  telefono_cliente: string;
  carnet_cliente?: string;
  tipo_de_pago: string;

  fecha_pedido: Date;
  hora_entrega_acordada: Date;
  hora_entrega_rango_final: Date;
  hora_entrega_real: Date;

  observaciones: string;
  lugar_origen?: Types.ObjectId; 
  tipo_destino?: 'sucursal' | 'otro_lugar';
  lugar_entrega: string;
  ubicacion_link?: string;

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
  qr_code?: string;
  shipping_qr_code?: string;
  shipping_qr_payload?: string;
  shipping_qr_image_path?: string;
  buyer_tracking_code?: string;
  numero_guia?: string;
  guia_sequence?: number;
  simple_package_order?: boolean;
  simple_package_source_id?: Types.ObjectId;

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
