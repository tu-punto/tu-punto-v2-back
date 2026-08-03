import { Document } from "mongoose";

export interface IFinanceStatsMonthlyDocument extends Document {
  monthKey: string;
  branchId: string;
  branchName: string;
  monthlyPaymentsIncome: number;
  expenses: number;
  investments: number;
  commissionIncome: number;
  deliveryIncomeReal: number;
  deliveryIncomePotential: number;
  deliveryExpenses: number;
  externalDeliveryIncome: number;
  externalDeliveredPackageTotalReal: number;
  externalDeliveredPackageTotalPotential: number;
  simplePackagesNoDeliveryTotalReal: number;
  simplePackagesNoDeliveryTotalPotential: number;
  simplePackagesInterbranchTotalReal: number;
  simplePackagesInterbranchTotalPotential: number;
  expenseCategories: Record<string, number>;
  builtAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
