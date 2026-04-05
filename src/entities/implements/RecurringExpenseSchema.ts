import { Schema, Types, model } from "mongoose";
import { IRecurringExpenseDocument } from "../documents/IRecurringExpenseDocument";

const RecurringExpenseSchema = new Schema<IRecurringExpenseDocument>(
  {
    tipo: {
      type: String,
      required: true,
      trim: true,
    },
    detalle: {
      type: String,
      default: "",
      trim: true,
    },
    monto: {
      type: Number,
      required: true,
      min: 0,
    },
    id_sucursal: {
      type: Types.ObjectId,
      ref: "Sucursal",
      default: null,
    },
    hasta_cuando_se_pago: {
      type: Date,
      required: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "Gasto_Recurrente",
    timestamps: true,
  }
);

export const RecurringExpenseModel = model<IRecurringExpenseDocument>(
  "RecurringExpense",
  RecurringExpenseSchema
);
