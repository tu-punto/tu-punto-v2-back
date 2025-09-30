import { Schema, model } from "mongoose";
import { ICierreCajaDocument } from "../documents/ICierreCajaDocument"; 

const CierreCajaSchema = new Schema<ICierreCajaDocument>({
  responsable: {
    id: { type: Schema.Types.ObjectId, ref: "User" },
    nombre: String,
  },  
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

  efectivo_diario: [
    {
      corte: Number,     
      cantidad: Number,  
    }
  ],
  operaciones_adicionales: [
    {
      tipo: {
        type: String,
        enum: ["delivery", "gasto_profit", "pago_cliente"],
        required: true,
      },
      descripcion: { type: String, required: true },
      cliente: { type: String }, // Solo aplica para "pago_cliente"
      metodo: {
        type: String,
        enum: ["efectivo", "qr"],
        required: true,
      },
      monto: { type: Number, required: true },
    }
  ],


  id_sucursal: { type: Schema.Types.ObjectId, ref: 'Sucursal' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});


export const CierreCajaModel = model<ICierreCajaDocument>("CierreCaja", CierreCajaSchema);
