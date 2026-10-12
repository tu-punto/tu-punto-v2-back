import { Schema, model } from "mongoose";

// Liquidación inmutable: conserva qué entregas formaron parte de cada pago.
const PagoGranjeroSchema = new Schema(
  {
    granjero: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ventas: [{ type: Schema.Types.ObjectId, ref: "Venta", required: true }],
    monto: { type: Number, required: true },
    registrado_por: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pagado_en: { type: Date, default: Date.now },
    observacion: { type: String, default: "" },
  },
  { collection: "PagoGranjero", timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

PagoGranjeroSchema.index({ granjero: 1, pagado_en: -1 });
export const PagoGranjeroModel = model("PagoGranjero", PagoGranjeroSchema);
