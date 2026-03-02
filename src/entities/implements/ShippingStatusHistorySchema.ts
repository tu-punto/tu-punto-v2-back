import { Document, Schema, Types, model } from "mongoose";

export interface IShippingStatusHistoryDocument extends Document {
  shippingId: Types.ObjectId;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
  note?: string;
  source: "qr" | "manual" | "system";
  createdAt: Date;
  updatedAt: Date;
}

const ShippingStatusHistorySchema = new Schema<IShippingStatusHistoryDocument>(
  {
    shippingId: {
      type: Schema.Types.ObjectId,
      ref: "Pedido",
      required: true
    },
    fromStatus: {
      type: String,
      required: true
    },
    toStatus: {
      type: String,
      required: true
    },
    changedBy: {
      type: String,
      required: false
    },
    note: {
      type: String,
      required: false
    },
    source: {
      type: String,
      enum: ["qr", "manual", "system"],
      default: "qr",
      required: true
    }
  },
  {
    collection: "ShippingStatusHistory",
    timestamps: true
  }
);

ShippingStatusHistorySchema.index({ shippingId: 1, createdAt: -1 });

export const ShippingStatusHistoryModel = model<IShippingStatusHistoryDocument>(
  "ShippingStatusHistory",
  ShippingStatusHistorySchema
);

