import { Schema, model, Types } from 'mongoose';
import { IVentaDocument } from '../documents/IVentaDocument';

const VentaSchema = new Schema<IVentaDocument>({
  cantidad: {
    type: Number,
    required: true
  },
  precio_unitario: {
    type: Number,
    required: true
  },
  precio_original: {
    type: Number,
    default: 0
  },
  utilidad: {
    type: Number,
    default: 0
  },
  comision: {
    type: Number,
    default: 0,
  },
  deposito_realizado: {
    type: Boolean,
    default: false
  },
  producto: {
    type: Schema.Types.ObjectId,
    ref: 'Producto'
  },
  pedido: {
    type: Schema.Types.ObjectId,
    ref: 'Pedido'
  },
  vendedor: {
    type: Schema.Types.ObjectId,
    ref: 'Vendedor'
  },
  sucursal: {
  type: Schema.Types.ObjectId,
  ref: 'Sucursal',
  required: true
  },

  quien_paga_delivery: {
  type: String,
  enum: ["comprador", "vendedor", "tupunto"],
  default: "comprador"
  },
  nombre_variante: {
    type: String,
    default: "",
  },
  variantes: {
    type: Map,
    of: String,
    required: false
  },
  variantKey: {
    type: String,
    required: false
  },
  pricingPromotion: {
    label: { type: String, default: null },
    title: { type: String, default: null },
    pricingMode: { type: String, enum: ["simple", "tiers", "conditional"], default: null },
    conditionalQuestion: { type: String, default: null },
    conditionalAccepted: { type: Boolean, default: null },
    simplePrice: { type: Number, default: null },
    effectivePrice: { type: Number, default: null },
  },
  promoAccepted: {
    type: Boolean,
    default: false,
  },
  promoLabel: {
    type: String,
    default: null,
  },
  promoQuestion: {
    type: String,
    default: null,
  },

}, {
  collection: 'Venta',
  timestamps: false
});

export const VentaModel = model<IVentaDocument>('Venta', VentaSchema);
