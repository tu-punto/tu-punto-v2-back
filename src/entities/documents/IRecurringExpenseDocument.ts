import { Document } from "mongoose";
import { IRecurringExpense } from "../IRecurringExpense";

export interface IRecurringExpenseDocument extends IRecurringExpense, Document {}
