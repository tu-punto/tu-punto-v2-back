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
  utilidad: {
    type: Number,
    default: 0
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

}, {
  collection: 'Venta',
  timestamps: false
});

export const VentaModel = model<IVentaDocument>('Venta', VentaSchema);
