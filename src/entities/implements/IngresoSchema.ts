import { Schema, model, Types } from 'mongoose';
import { IIngresoDocument } from '../documents/IIngresoDocument';

const IngresoSchema = new Schema({
  fecha_ingreso: {
    type: Date,
    default: Date.now
  },
  estado: {
    type: String,
    required: true
  },
  cantidad_ingreso: {
    type: Number,
    required: true
  },
  nombre_variante: {
    type: String,
    required: true
  },
  producto: {
    type: Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  vendedor: {
    type: Types.ObjectId,
    ref: 'Vendedor',
    required: true
  },
  sucursal: {
    type: Types.ObjectId,
    ref: 'Sucursal',
    required: true
  }
}, {
  collection: 'Ingreso',
  timestamps: false
});

export const IngresoModel = model<IIngresoDocument>('Ingreso', IngresoSchema);
