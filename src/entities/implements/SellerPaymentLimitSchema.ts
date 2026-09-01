import { Schema, model } from "mongoose";

export interface ISellerPaymentLimitDocument {
  configKey: string;
  limit: number | null;
  updatedBy?: Schema.Types.ObjectId;
}

const SellerPaymentLimitSchema = new Schema<ISellerPaymentLimitDocument>(
  {
    configKey: { type: String, required: true, unique: true, default: "global" },
    limit: { type: Number, default: null, min: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { collection: "SellerPaymentLimit", timestamps: true }
);

export const SellerPaymentLimitModel = model<ISellerPaymentLimitDocument>(
  "SellerPaymentLimit",
  SellerPaymentLimitSchema
);
