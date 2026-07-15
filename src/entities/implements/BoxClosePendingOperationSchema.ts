import { Schema, model } from "mongoose";
import { IBoxClosePendingOperationDocument } from "../documents/IBoxClosePendingOperationDocument";

const BoxClosePendingOperationSchema = new Schema<IBoxClosePendingOperationDocument>(
  {
    source_key: { type: String, required: true, unique: true, index: true },
    business_date: { type: String, required: true, index: true },
    id_sucursal: { type: Schema.Types.ObjectId, ref: "Sucursal", required: true, index: true },
    operation: {
      tipo: {
        type: String,
        enum: ["ingreso", "gasto", "delivery", "gasto_profit", "pago_cliente"],
        required: true,
      },
      descripcion: { type: String, required: true },
      concepto: { type: String },
      categoria: { type: String },
      cliente: { type: String },
      metodo: {
        type: String,
        enum: ["efectivo", "qr"],
        required: true,
      },
      monto: { type: Number, required: true },
      afecta_empresa: { type: Boolean, default: true },
      fecha: { type: Date },
      id_vendedor: { type: Schema.Types.ObjectId, ref: "Vendedor" },
      id_sucursal: { type: Schema.Types.ObjectId, ref: "Sucursal" },
      finance_flux_id: { type: Schema.Types.ObjectId, ref: "FlujoFinanciero" },
      source_key: { type: String },
      auto_generated: { type: Boolean, default: true },
    },
    applied_at: { type: Date },
    applied_box_close_id: { type: Schema.Types.ObjectId, ref: "CierreCaja" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const BoxClosePendingOperationModel = model<IBoxClosePendingOperationDocument>(
  "BoxClosePendingOperation",
  BoxClosePendingOperationSchema
);
