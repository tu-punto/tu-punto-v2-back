import { Schema, model } from "mongoose";
import { ICierreCajaDocument } from "./ICierreCajaDocument"; 

const CierreCajaSchema = new Schema<ICierreCajaDocument>({
  responsible: String,
  ventas_efectivo: Number,
  ventas_qr: Number,
  efectivo_inicial: Number,
  bancario_inicial: Number,
  ingresos_efectivo: Number,
  efectivo_esperado: Number,
  efectivo_real: Number,
  bancario_esperado: Number,
  bancario_real: Number,
  diferencia_efectivo: Number,
  diferencia_bancario: Number,
  observaciones: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  id_efectivo_diario: { type: Schema.Types.ObjectId, ref: 'EfectivoDiario' },
  id_sucursal: { type: Schema.Types.ObjectId, ref: 'Sucursal' },
});

export const CierreCajaModel = model<ICierreCajaDocument>("CierreCaja", CierreCajaSchema);
