import { Document, Schema, Types, model } from "mongoose";

export type ServiceAnnouncementRole = "admin" | "operator" | "seller";
export type ServiceAnnouncementStatus = "draft" | "published";

export interface IServiceAnnouncementDocument extends Document {
  title: string;
  version: string;
  summary?: string;
  body: string;
  regulation?: string;
  policyText?: string;
  targetRoles: ServiceAnnouncementRole[];
  requireAcceptance: boolean;
  sendPush: boolean;
  status: ServiceAnnouncementStatus;
  createdBy?: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceAnnouncementSchema = new Schema<IServiceAnnouncementDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      required: false,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    regulation: {
      type: String,
      required: false,
      trim: true,
    },
    policyText: {
      type: String,
      required: false,
      trim: true,
    },
    targetRoles: {
      type: [
        {
          type: String,
          enum: ["admin", "operator", "seller"],
        },
      ],
      default: ["seller"],
    },
    requireAcceptance: {
      type: Boolean,
      default: false,
    },
    sendPush: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    publishedAt: {
      type: Date,
      required: false,
    },
  },
  {
    collection: "ServiceAnnouncement",
    timestamps: true,
  }
);

ServiceAnnouncementSchema.index({ status: 1, publishedAt: -1, createdAt: -1 });
ServiceAnnouncementSchema.index({ targetRoles: 1, status: 1, publishedAt: -1 });

export const ServiceAnnouncementModel = model<IServiceAnnouncementDocument>(
  "ServiceAnnouncement",
  ServiceAnnouncementSchema
);
