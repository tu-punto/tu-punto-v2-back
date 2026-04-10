import { Document, Schema, Types, model } from "mongoose";

export interface INotificationDocument extends Document {
  userId: Types.ObjectId;
  shippingId?: Types.ObjectId;
  type: string;
  title: string;
  body: string;
  read: boolean;
  role?: "admin" | "operator" | "seller";
  data?: Record<string, unknown>;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shippingId: {
      type: Schema.Types.ObjectId,
      ref: "Pedido",
      required: false,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["admin", "operator", "seller"],
      required: false,
    },
    data: {
      type: Schema.Types.Mixed,
      required: false,
    },
    dedupeKey: {
      type: String,
      required: false,
      trim: true,
    },
    readAt: {
      type: Date,
      required: false,
    },
  },
  {
    collection: "Notification",
    timestamps: true,
  }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, sparse: true });

export const NotificationModel = model<INotificationDocument>("Notification", NotificationSchema);
