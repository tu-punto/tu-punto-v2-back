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
  id_producto: {
  type: Schema.Types.ObjectId,
  ref: 'Producto',
  required: true
},
  id_pedido: {
  type: Schema.Types.ObjectId,
  ref: 'Pedido',
  required: true
},
id_vendedor: {
  type: Schema.Types.ObjectId,
  ref: 'Vendedor',
  required: true
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
  }
}, {
  collection: 'Venta',
  timestamps: false
});

export const VentaModel = model<IVentaDocument>('Venta', VentaSchema);
