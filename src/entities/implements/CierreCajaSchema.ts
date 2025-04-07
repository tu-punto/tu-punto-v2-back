import { Schema, model, Types } from 'mongoose';

const CierreCajaSchema = new Schema({
  responsible: {
    type: String,
    required: true,
  },
  ventas_efectivo: {
    type: Number,
    required: true,
  },
  ventas_qr: {
    type: Number,
    required: true,
  },
  efectivo_inicial: {
    type: Number,
    required: true,
  },
  bancario_inicial: {
    type: Number,
    required: true,
  },
  ingresos_efectivo: {
    type: Number,
    required: true,
  },
  efectivo_esperado: {
    type: Number,
    required: true,
  },
  efectivo_real: {
    type: Number,
    required: true,
  },
  bancario_esperado: {
    type: Number,
    required: true,
  },
  bancario_real: {
    type: Number,
    required: true,
  },
  diferencia_efectivo: {
    type: Number,
    required: true,
  },
  diferencia_bancario: {
    type: Number,
    required: true,
  },
  observaciones: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  id_efectivo_diario: {
    type: Types.ObjectId,
    ref: 'EfectivoDiario',
    required: true,
  },
  id_sucursal: {
    type: Types.ObjectId,
    ref: 'Sucursal',
    required: true,
  },
}, {
  collection: 'Cierre_Caja',
  timestamps: false // usamos los campos `created_at` y `updated_at` personalizados
});

export const CierreCajaModel = model('CierreCaja', CierreCajaSchema);

