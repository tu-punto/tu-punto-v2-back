import { Schema, model, Types } from 'mongoose';
import { IFlujoFinancieroDocument } from '../documents/IFlujoFinancieroDocument';

const FlujoFinancieroSchema = new Schema({
  tipo: {
    type: String,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  concepto: {
    type: String,
    required: true
  },
  monto: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now,
    required: true
  },
  esDeuda: {
    type: Boolean,
    default: false
  },

  id_vendedor: {
    type: Types.ObjectId,
    ref: 'Vendedor',
    default: null
  },

  id_trabajador: {
    type: Types.ObjectId,
    ref: 'Trabajador',
    default: null
  }

}, {
  collection: 'Flujo_Financiero',
  timestamps: true
});

export const FlujoFinancieroModel = model<IFlujoFinancieroDocument>('FlujoFinanciero', FlujoFinancieroSchema);
