import { model, Schema } from "mongoose";
import { IPaqueteria } from "../IPaqueteria";

const PaqueteriaSchema = new Schema<IPaqueteria>(
  {
    nombre: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
    codigo_guia: { type: Number, required: true, unique: true, min: 2 },
    logo_url: { type: String, default: "" },
    color_primario: { type: String, default: "" },
    color_secundario: { type: String, default: "" },
    tarifa_fija: { type: Number, required: true, min: 0 },
    multa_cada_dias: { type: Number, required: true, min: 1 },
    monto_multa: { type: Number, required: true, min: 0 },
    rutas_habilitadas: [{ type: Schema.Types.ObjectId, ref: "SimplePackageBranchPrice" }],
  },
  { collection: "Paqueteria", timestamps: true }
);

PaqueteriaSchema.index({ nombre: 1 });

export const PaqueteriaModel = model<IPaqueteria>("Paqueteria", PaqueteriaSchema);
