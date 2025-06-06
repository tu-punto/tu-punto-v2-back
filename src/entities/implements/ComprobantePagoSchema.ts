import { Schema, model, Types } from 'mongoose';
import { IComprobantePagoDocument } from '../documents/IComprobantePagoDocument';

const ComprobantePagoSchema = new Schema<IComprobantePagoDocument>({
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
    type: Schema.Types.ObjectId,
    ref: 'Vendedor',
    required: true,
  }
}, {
  collection: 'Comprobante_Pago',
  timestamps: true
});

export const ComprobantePagoModel = model<IComprobantePagoDocument>('ComprobantePago', ComprobantePagoSchema);
