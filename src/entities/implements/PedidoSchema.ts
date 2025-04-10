import { Schema, model, Types } from 'mongoose';
import { IPedidoDocument } from '../documents/IPedidoDocument';

const PedidoSchema = new Schema({
  cliente: {
    type: String,
    required: true
  },
  telefono_cliente: {
    type: Number,
    default: 0
  },
  tipo_de_pago: {
    type: String,
    required: true
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
  observaciones: {
    type: String,
    default: ""
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
  venta: [{
    type: Types.ObjectId,
    ref: 'Venta'
  }]
}, {
  collection: 'Pedido',
  timestamps: false
});

export const PedidoModel = model<IPedidoDocument>('Pedido', PedidoSchema);
