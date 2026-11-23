import { model, Schema } from "mongoose";

const PedidoPaqueteriaExternaSchema = new Schema({
  paqueteria: { type: Schema.Types.ObjectId, ref: "Paqueteria", required: true, index: true },
  guia_propia: { type: String, required: true, trim: true },
  destinatario: { type: String, required: true, trim: true },
  telefono: { type: String, default: "", trim: true },
  descripcion: { type: String, required: true, trim: true },
  anulado: { type: Boolean, default: false },
  anulado_en: { type: Date },
}, { collection: "PedidoPaqueteriaExterna", timestamps: true });
PedidoPaqueteriaExternaSchema.index({ paqueteria: 1, guia_propia: 1 }, { unique: true });
export const PedidoPaqueteriaExternaModel = model("PedidoPaqueteriaExterna", PedidoPaqueteriaExternaSchema);
