import { Document, Schema, Types, model } from "mongoose";

export type ServiceAnnouncementRole = "admin" | "operator" | "seller";
export type ServiceAnnouncementStatus = "draft" | "published";
export type ServiceAnnouncementAttachmentKind = "link" | "file";

export interface IServiceAnnouncementAttachment {
  kind: ServiceAnnouncementAttachmentKind;
  title?: string;
  url: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  extension?: string;
  s3Key?: string;
}

export interface IServiceAnnouncementDocument extends Document {
  title: string;
  version: string;
  summary?: string;
  body: string;
  regulation?: string;
  policyText?: string;
  attachments: IServiceAnnouncementAttachment[];
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
    attachments: {
      type: [
        {
          kind: {
            type: String,
            enum: ["link", "file"],
            required: true,
          },
          title: {
            type: String,
            required: false,
            trim: true,
          },
          url: {
            type: String,
            required: true,
            trim: true,
          },
          fileName: {
            type: String,
            required: false,
            trim: true,
          },
          contentType: {
            type: String,
            required: false,
            trim: true,
          },
          size: {
            type: Number,
            required: false,
            min: 0,
          },
          extension: {
            type: String,
            required: false,
            trim: true,
          },
          s3Key: {
            type: String,
            required: false,
            trim: true,
          },
        },
      ],
      default: [],
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
