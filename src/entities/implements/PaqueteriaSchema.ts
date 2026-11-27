import { model, Schema } from "mongoose";
import { IPaqueteria } from "../IPaqueteria";

const PaqueteriaSchema = new Schema<IPaqueteria>(
  {
    nombre: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
    tipo: { type: String, enum: ["operativa", "externa"], default: "operativa" },
    codigo_guia: { type: Number, min: 2 },
    slug: { type: String, trim: true, lowercase: true },
    formato_guia: { type: String, enum: ["libre", "tupunto", "personalizado"], default: "libre" },
    prefijo_guia: { type: String, trim: true, default: "" },
    logo_url: { type: String, default: "" },
    color_primario: { type: String, default: "" },
    color_secundario: { type: String, default: "" },
    tarifa_fija: { type: Number, min: 0 },
    multa_cada_dias: { type: Number, min: 1 },
    monto_multa: { type: Number, min: 0 },
    rutas_habilitadas: [{ type: Schema.Types.ObjectId, ref: "SimplePackageBranchPrice" }],
  },
  { collection: "Paqueteria", timestamps: true }
);

PaqueteriaSchema.index({ nombre: 1 });
PaqueteriaSchema.index({ codigo_guia: 1 }, { unique: true, sparse: true });
PaqueteriaSchema.index({ slug: 1 }, { unique: true, sparse: true });

export const PaqueteriaModel = model<IPaqueteria>("Paqueteria", PaqueteriaSchema);
