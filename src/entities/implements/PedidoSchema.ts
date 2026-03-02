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
  observaciones: {
    type: String,
    default: ""
  },
  lugar_origen: {
    type: Schema.Types.ObjectId,
    ref: 'Sucursal',
    required: false
  },

  lugar_entrega: {
    type: String,
    required: true
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

export const PedidoModel = model<IPedidoDocument>('Pedido', PedidoSchema);
