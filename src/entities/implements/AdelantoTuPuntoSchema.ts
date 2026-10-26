import { Schema, model } from "mongoose";

/**
 * Comprobante independiente del cobro. El pedido conserva sus campos de pago
 * por compatibilidad, pero este documento permite auditar el adelanto incluso
 * si luego se cancela o se modifica el pedido.
 */
const AdelantoTuPuntoSchema = new Schema(
  {
    pedido: { type: Schema.Types.ObjectId, ref: "Pedido", required: true, unique: true, index: true },
    sucursal: { type: Schema.Types.ObjectId, ref: "Sucursal", required: false, index: true },
    registrado_por: { type: Schema.Types.ObjectId, ref: "User", required: false },
    monto: { type: Number, required: true, min: 0 },
    efectivo: { type: Number, required: true, min: 0, default: 0 },
    qr: { type: Number, required: true, min: 0, default: 0 },
    estado: { type: String, enum: ["activo", "revertido"], default: "activo", index: true },
    cierre_caja: { type: Schema.Types.ObjectId, ref: "CierreCaja", required: false, index: true },
    revertido_en: { type: Date, required: false },
    motivo_reversion: { type: String, required: false },
  },
  { collection: "AdelantoTuPunto", timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

AdelantoTuPuntoSchema.index({ sucursal: 1, created_at: 1, estado: 1 });
export const AdelantoTuPuntoModel = model("AdelantoTuPunto", AdelantoTuPuntoSchema);
