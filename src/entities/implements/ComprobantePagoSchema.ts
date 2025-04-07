import { Schema, model, Types } from 'mongoose';

const ComprobantePagoSchema = new Schema({
  fecha_emision: {
    type: Date,
    required: true,
    default: Date.now,
  },
  hora_emision: {
    type: Date,
    required: true,
    default: Date.now,
  },
  comprobante_entrada_pdf: {
    type: String,
    required: true,
  },
  total_ventas: {
    type: Number,
    required: true,
  },
  total_adelantos: {
    type: Number,
    required: true,
  },
  vendedor: {
    type: Types.ObjectId,
    ref: 'Vendedor',
    required: true,
  }
}, {
  collection: 'Comprobante_Pago',
  timestamps: false
});

export const ComprobantePagoModel = model('ComprobantePago', ComprobantePagoSchema);
