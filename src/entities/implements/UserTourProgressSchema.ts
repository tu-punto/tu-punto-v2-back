import { Document, Schema, Types, model } from "mongoose";

export const USER_TOUR_KEYS = [
  "seller-welcome",
  "seller-simple-deliveries",
  "seller-stock-shipping-guide",
  "seller-stock-deliveries",
  "seller-stock-withdrawal-request",
  "staff-operator-sales",
  "staff-stock-ingress",
  "staff-product-create",
  "staff-branch-transfer",
  "staff-variant-create",
  "staff-external-delivery-create",
] as const;
export type UserTourKey = (typeof USER_TOUR_KEYS)[number];
export type UserTourStatus = "unseen" | "seen";

export interface IUserTourProgressDocument extends Document {
  user: Types.ObjectId;
  tourKey: UserTourKey;
  status: UserTourStatus;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserTourProgressSchema = new Schema<IUserTourProgressDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tourKey: {
      type: String,
      required: true,
      trim: true,
      enum: USER_TOUR_KEYS,
    },
    status: {
      type: String,
      required: true,
      enum: ["unseen", "seen"],
      default: "unseen",
    },
    completedAt: {
      type: Date,
      required: false,
      default: null,
    },
  },
  {
    collection: "UserTourProgress",
    timestamps: true,
  }
);

UserTourProgressSchema.index({ user: 1, tourKey: 1 }, { unique: true });
UserTourProgressSchema.index({ user: 1, status: 1, updatedAt: -1 });

export const UserTourProgressModel = model<IUserTourProgressDocument>(
  "UserTourProgress",
  UserTourProgressSchema
);
