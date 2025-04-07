import { Schema, model, Types } from 'mongoose';

export const EfectivoDiarioSchema = new Schema({
  corte_0_2: { type: Number, default: 0 },
  corte_0_5: { type: Number, default: 0 },
  corte_1:   { type: Number, default: 0 },
  corte_2:   { type: Number, default: 0 },
  corte_5:   { type: Number, default: 0 },
  corte_10:  { type: Number, default: 0 },
  corte_20:  { type: Number, default: 0 },
  corte_50:  { type: Number, default: 0 },
  corte_100: { type: Number, default: 0 },
  corte_200: { type: Number, default: 0 },

  total_coins: { type: Number, default: 0 },
  total_bills: { type: Number, default: 0 },

  created_at: {
    type: Date,
    default: Date.now,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now,
    required: true
  },

  id_cierre_caja: {
    type: Types.ObjectId,
    ref: 'CierreCaja',
    required: true
  }
}, {
  collection: 'Efectivo_Diario',
  timestamps: false
});

export const EfectivoDiarioModel = model('EfectivoDiario', EfectivoDiarioSchema);
