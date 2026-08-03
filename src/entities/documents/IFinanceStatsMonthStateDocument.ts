import { Document } from "mongoose";

export interface IFinanceStatsMonthStateDocument extends Document {
  monthKey: string;
  dirty: boolean;
  rebuildRequestedAt?: Date | null;
  rebuilding: boolean;
  rebuiltAt?: Date | null;
  lastError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
