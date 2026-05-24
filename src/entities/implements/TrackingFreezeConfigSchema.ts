import { Schema, model } from "mongoose";
import { ITrackingFreezeConfig } from "../ITrackingFreezeConfig";

const TrackingFreezeConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    activated_at: {
      type: Date,
      required: false,
    },
    deactivated_at: {
      type: Date,
      required: false,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    collection: "TrackingFreezeConfig",
    timestamps: false,
  }
);

export const TrackingFreezeConfigModel = model<ITrackingFreezeConfig>(
  "TrackingFreezeConfig",
  TrackingFreezeConfigSchema
);
