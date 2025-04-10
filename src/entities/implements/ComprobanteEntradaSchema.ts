import { Schema, model, Types } from 'mongoose';

const ComprobanteEntradaSchema = new Schema({
  fecha_emision: {
    type: Date,
    default: Date.now,
    required: true
  },
  hora_emision: {
    type: Date,
    default: Date.now,
    required: true
  },
  comprobante_pdf: {
    type: String,
    required: true
  },
  vendedor: {
    type: Types.ObjectId,
    ref: 'Vendedor',
    required: true
  }
}, {
  collection: 'Comprobante_Entrada',
  timestamps: false
});

export const ComprobanteEntradaModel = model('ComprobanteEntrada', ComprobanteEntradaSchema);
