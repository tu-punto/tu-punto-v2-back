import { Schema, model } from "mongoose";
import { IFinanceStatsMonthlyDocument } from "../documents/IFinanceStatsMonthlyDocument";

const FinanceStatsMonthlySchema = new Schema<IFinanceStatsMonthlyDocument>(
  {
    monthKey: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    branchName: { type: String, default: "" },
    monthlyPaymentsIncome: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    investments: { type: Number, default: 0 },
    commissionIncome: { type: Number, default: 0 },
    deliveryIncomeReal: { type: Number, default: 0 },
    deliveryIncomePotential: { type: Number, default: 0 },
    deliveryExpenses: { type: Number, default: 0 },
    externalDeliveryIncome: { type: Number, default: 0 },
    externalDeliveredPackageTotalReal: { type: Number, default: 0 },
    externalDeliveredPackageTotalPotential: { type: Number, default: 0 },
    simplePackagesNoDeliveryTotalReal: { type: Number, default: 0 },
    simplePackagesNoDeliveryTotalPotential: { type: Number, default: 0 },
    simplePackagesInterbranchTotalReal: { type: Number, default: 0 },
    simplePackagesInterbranchTotalPotential: { type: Number, default: 0 },
    expenseCategories: { type: Map, of: Number, default: {} },
    builtAt: { type: Date, default: Date.now },
  },
  {
    collection: "FinanceStatsMonthly",
    timestamps: true,
  }
);

FinanceStatsMonthlySchema.index({ monthKey: 1, branchId: 1 }, { unique: true });

export const FinanceStatsMonthlyModel = model<IFinanceStatsMonthlyDocument>(
  "FinanceStatsMonthly",
  FinanceStatsMonthlySchema
);
