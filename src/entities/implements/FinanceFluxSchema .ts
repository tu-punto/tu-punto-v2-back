import mongoose, { Schema } from "mongoose";
import { IFinanceFlux } from "../IFinanceFlux";

const FinanceFluxSchema = new Schema<IFinanceFlux>(
  {
    tipo: { type: String, enum: ["INGRESO", "GASTO", "INVERSION"], required: true },
    monto: { type: Number, required: true },
    fecha: { type: Date, required: true },
    categoria: { type: String },
    concepto: { type: String },
    comentario: { type: String },
    esDeuda: { type: Boolean },
    id_vendedor: { type: Schema.Types.ObjectId, ref: "Vendedor" },
  },
  { timestamps: true }
);

export const FinanceFluxModel = mongoose.model("FinanceFlux", FinanceFluxSchema);