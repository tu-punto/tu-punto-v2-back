import { Schema, Types, model } from "mongoose";

export type StockWithdrawalRequestStatus = "pending" | "approved" | "rejected";

const StockWithdrawalRequestItemSchema = new Schema(
  {
    product: {
      type: Types.ObjectId,
      ref: "Producto",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    variantKey: {
      type: String,
      required: false,
      trim: true,
    },
    variantLabel: {
      type: String,
      required: false,
      trim: true,
    },
    variantes: {
      type: Map,
      of: String,
      required: false,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    stockAtRequest: {
      type: Number,
      required: false,
      min: 0,
    },
  },
  { _id: false }
);

const StockWithdrawalRequestSchema = new Schema(
  {
    seller: {
      type: Types.ObjectId,
      ref: "Vendedor",
      required: true,
    },
    branch: {
      type: Types.ObjectId,
      ref: "Sucursal",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
    items: {
      type: [StockWithdrawalRequestItemSchema],
      default: [],
      validate: {
        validator: (items: unknown[]) => Array.isArray(items) && items.length > 0,
        message: "La solicitud debe tener al menos un producto",
      },
    },
    comment: {
      type: String,
      required: false,
      trim: true,
    },
    requestedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
    },
    approvedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    rejectedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
    },
    rejectedAt: {
      type: Date,
      required: false,
    },
    rejectionReason: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    collection: "StockWithdrawalRequest",
    timestamps: true,
  }
);

StockWithdrawalRequestSchema.index({ status: 1, branch: 1, createdAt: -1 });
StockWithdrawalRequestSchema.index({ seller: 1, createdAt: -1 });

export const StockWithdrawalRequestModel = model(
  "StockWithdrawalRequest",
  StockWithdrawalRequestSchema
);
