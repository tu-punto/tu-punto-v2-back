import { Document, Schema, Types, model } from "mongoose";

export interface IServiceAnnouncementReceiptDocument extends Document {
  announcementId: Types.ObjectId;
  userId: Types.ObjectId;
  acknowledgedAt?: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceAnnouncementReceiptSchema = new Schema<IServiceAnnouncementReceiptDocument>(
  {
    announcementId: {
      type: Schema.Types.ObjectId,
      ref: "ServiceAnnouncement",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    acknowledgedAt: {
      type: Date,
      required: false,
    },
    acceptedAt: {
      type: Date,
      required: false,
    },
  },
  {
    collection: "ServiceAnnouncementReceipt",
    timestamps: true,
  }
);

ServiceAnnouncementReceiptSchema.index({ announcementId: 1, userId: 1 }, { unique: true });
ServiceAnnouncementReceiptSchema.index({ userId: 1, acceptedAt: 1, acknowledgedAt: 1 });

export const ServiceAnnouncementReceiptModel = model<IServiceAnnouncementReceiptDocument>(
  "ServiceAnnouncementReceipt",
  ServiceAnnouncementReceiptSchema
);
