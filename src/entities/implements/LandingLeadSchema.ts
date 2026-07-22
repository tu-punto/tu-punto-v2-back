import { Document, Schema, model } from "mongoose";

export interface ILandingLeadDocument extends Document {
  nombre: string;
  telefono: string;
  ciudad: string;
  email: string;
  productos: string;
  sucursales_interes: string[];
  pagina_origen: "inicio" | "vendedores";
  contactado: boolean;
  contactado_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LandingLeadSchema = new Schema<ILandingLeadDocument>(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    telefono: {
      type: String,
      required: true,
      trim: true,
    },
    ciudad: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    productos: {
      type: String,
      required: true,
      trim: true,
    },
    sucursales_interes: {
      type: [String],
      default: [],
    },
    pagina_origen: {
      type: String,
      enum: ["inicio", "vendedores"],
      required: true,
      default: "inicio",
    },
    contactado: {
      type: Boolean,
      default: false,
    },
    contactado_at: {
      type: Date,
      required: false,
    },
  },
  {
    collection: "LandingLead",
    timestamps: true,
  }
);

LandingLeadSchema.index({ contactado: 1, createdAt: -1 });
LandingLeadSchema.index({ ciudad: 1, createdAt: -1 });
LandingLeadSchema.index({ pagina_origen: 1, createdAt: -1 });

export const LandingLeadModel = model<ILandingLeadDocument>("LandingLead", LandingLeadSchema);
