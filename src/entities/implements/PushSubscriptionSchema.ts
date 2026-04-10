import { Document, Schema, Types, model } from "mongoose";

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface IPushSubscriptionDocument extends Document {
  audience: "internal" | "buyer";
  userId?: Types.ObjectId;
  shippingId?: Types.ObjectId;
  endpoint: string;
  keys: IPushSubscriptionKeys;
  role?: "admin" | "operator" | "seller";
  enabled: boolean;
  userAgent?: string;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    audience: {
      type: String,
      enum: ["internal", "buyer"],
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    shippingId: {
      type: Schema.Types.ObjectId,
      ref: "Pedido",
      required: false,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
        trim: true,
      },
      auth: {
        type: String,
        required: true,
        trim: true,
      },
    },
    role: {
      type: String,
      enum: ["admin", "operator", "seller"],
      required: false,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    userAgent: {
      type: String,
      required: false,
      trim: true,
    },
    lastSeenAt: {
      type: Date,
      required: false,
    },
  },
  {
    collection: "PushSubscription",
    timestamps: true,
  }
);

PushSubscriptionSchema.index({ audience: 1, userId: 1, enabled: 1 });
PushSubscriptionSchema.index({ audience: 1, shippingId: 1, enabled: 1 });
PushSubscriptionSchema.index(
  { audience: 1, endpoint: 1, userId: 1, shippingId: 1 },
  { unique: true }
);

export const PushSubscriptionModel = model<IPushSubscriptionDocument>(
  "PushSubscription",
  PushSubscriptionSchema
);
