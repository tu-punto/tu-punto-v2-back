import { Schema, model } from "mongoose";
import { IFinanceStatsMonthStateDocument } from "../documents/IFinanceStatsMonthStateDocument";

const FinanceStatsMonthStateSchema = new Schema<IFinanceStatsMonthStateDocument>(
  {
    monthKey: { type: String, required: true, unique: true },
    dirty: { type: Boolean, default: true, index: true },
    rebuildRequestedAt: { type: Date, default: null },
    rebuilding: { type: Boolean, default: false, index: true },
    rebuiltAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  {
    collection: "FinanceStatsMonthState",
    timestamps: true,
  }
);

export const FinanceStatsMonthStateModel = model<IFinanceStatsMonthStateDocument>(
  "FinanceStatsMonthState",
  FinanceStatsMonthStateSchema
);
