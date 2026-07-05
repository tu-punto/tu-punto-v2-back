import { Schema, model, Types } from 'mongoose';
import { IPedidoDocument } from '../documents/IPedidoDocument';

const PedidoSchema = new Schema({
  cliente: {
    type: String,
    required: true
  },
  telefono_cliente: {
    type: String,
    required: false
  },
  carnet_cliente: {
    type: String,
    required: false,
    default: ""
  },
  tipo_de_pago: {
    type: String,
    required: false
  },
  fecha_pedido: {
    type: Date,
    default: Date.now
  },
  hora_entrega_acordada: {
    type: Date,
    default: Date.now
  },
  hora_entrega_real: {
    type: Date,
    default: Date.now
  },
  hora_entrega_rango_final: {
    type: Date,
    required: false,
  },
  storage_fee_start_at: {
    type: Date,
    required: false,
  },
  late_pickup_fee: {
    type: Number,
    default: 0,
  },
  observaciones: {
    type: String,
    default: ""
  },
  lugar_origen: {
    type: Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: false
  },
  tipo_destino: {
    type: String,
    enum: ["sucursal", "otro_lugar"],
    default: "otro_lugar"
  },

  lugar_entrega: {
    type: String,
    required: true
  },
  ubicacion_link: {
    type: String,
    default: ""
  },
  costo_delivery: {
    type: Number,
    default: 0
  },
  cargo_delivery: {
    type: Number,
    default: 0
  },
  estado_pedido: {
    type: String,
    required: true
  },
  origen_pedido: {
    type: String,
    enum: ["interno", "catalogo"],
    default: "interno",
    index: true
  },
  catalog_order_id: {
    type: String,
    required: false,
    index: true
  },
  catalog_status_sync: {
    type: String,
    enum: ["pending", "synced", "failed"],
    required: false
  },
  catalog_status_sync_error: {
    type: String,
    default: ""
  },
  catalog_stock_status: {
    type: String,
    enum: ["pending", "reserved", "restored"],
    required: false,
    index: true
  },
  catalog_stock_items: [
    {
      internalProductId: { type: String, required: true },
      internalVariantKey: { type: String, required: true },
      internalBranchId: { type: String, required: true },
      quantity: { type: Number, required: true },
      currentStock: { type: Number, required: true }
    }
  ],
  rechazado_en: {
    type: Date,
    required: false
  },
  rechazado_por: {
    type: String,
    required: false
  },
  motivo_rechazo: {
    type: String,
    default: ""
  },
  retirado_por_vendedor: {
    type: Boolean,
    default: false
  },
  seller_withdrawn_at: {
    type: Date,
    required: false
  },
  adelanto_cliente: {
    type: Number,
    default: 0
  },
  esta_pagado: {
    type: String,
    enum: ['si', 'no', 'adelanto'],
    default: 'no'
  },
  pagado_al_vendedor: {
    type: Boolean,
    default: false
  },
  subtotal_qr: {
    type: Number,
    default: 0
  },
  subtotal_efectivo: {
    type: Number,
    default: 0
  },
  trabajador: {
    type: Types.ObjectId,
    ref: 'Trabajador',
    required: false
  },
  sucursal: {
    type: Types.ObjectId,
    ref: 'Sucursal',
    required: false
  },
  qr_code: {
    type: String,
    default: ""
  },
  shipping_qr_code: {
    type: String,
    default: ""
  },
  shipping_qr_payload: {
    type: String,
    default: ""
  },
  shipping_qr_image_path: {
    type: String,
    default: ""
  },
  buyer_tracking_code: {
    type: String,
    default: "",
    index: true,
  },
  public_tracking_received_at: {
    type: Date,
    required: false,
  },
  public_tracking_schedule_base_at: {
    type: Date,
    required: false,
  },
  public_tracking_ready_for_pickup_at: {
    type: Date,
    required: false,
  },
  public_tracking_frozen: {
    type: Boolean,
    default: false,
    index: true,
  },
  public_tracking_frozen_status: {
    type: String,
    required: false,
  },
  public_tracking_frozen_at: {
    type: Date,
    required: false,
  },
  numero_guia: {
    type: String,
    required: false,
    default: "",
    index: true,
  },
  guia_sequence: {
    type: Number,
    required: false,
    index: true,
  },
  simple_package_order: {
    type: Boolean,
    default: false,
  },
  simple_package_source_id: {
    type: Schema.Types.ObjectId,
    ref: 'VentaExterna',
    required: false,
    default: null,
  },
  venta: [{
    type: Types.ObjectId,
    ref: 'Venta'
  }],
  productos_temporales: [
    {
      producto: { type: String, required: true },
      cantidad: { type: Number, required: true },
      precio_unitario: { type: Number, required: true },
      utilidad: { type: Number, default: 0 },
      id_vendedor: { type: Schema.Types.ObjectId, ref: 'Vendedor', required: true }
    }
  ],
}, {
  collection: 'Pedido',
  timestamps: false
});

PedidoSchema.index({ shipping_qr_code: 1 }, { sparse: true });
PedidoSchema.index(
  { catalog_order_id: 1 },
  { unique: true, partialFilterExpression: { catalog_order_id: { $type: "string", $gt: "" } } }
);
PedidoSchema.index(
  { numero_guia: 1 },
  { unique: true, partialFilterExpression: { numero_guia: { $type: "string", $gt: "" } } }
);

export const PedidoModel = model<IPedidoDocument>('Pedido', PedidoSchema);
