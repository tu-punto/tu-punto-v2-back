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
  storage_fee_start_at?: Date;
  late_pickup_fee?: number;

  observaciones: string;
  lugar_origen?: Types.ObjectId; 
  tipo_destino?: 'sucursal' | 'otro_lugar';
  lugar_entrega: string;
  ubicacion_link?: string;

  costo_delivery: number;
  cargo_delivery: number;

  estado_pedido: string;
  origen_pedido?: 'interno' | 'catalogo';
  catalog_order_id?: string;
  catalog_status_sync?: 'pending' | 'synced' | 'failed';
  catalog_status_sync_error?: string;
  catalog_stock_status?: 'pending' | 'reserved' | 'restored';
  catalog_stock_items?: Array<{
    internalProductId: string;
    internalVariantKey: string;
    internalBranchId: string;
    quantity: number;
    currentStock: number;
  }>;
  rechazado_en?: Date;
  rechazado_por?: string;
  motivo_rechazo?: string;
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
  public_tracking_received_at?: Date;
  public_tracking_schedule_base_at?: Date;
  public_tracking_frozen?: boolean;
  public_tracking_frozen_status?: string;
  public_tracking_frozen_at?: Date;
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
