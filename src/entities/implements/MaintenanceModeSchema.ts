import { Document, Schema, Types, model } from "mongoose";

export type MaintenanceAllowedRole = "admin" | "operator" | "seller";

export interface IMaintenanceModeDocument extends Document {
  configKey: string;
  enabled: boolean;
  message: string;
  subtitle?: string;
  allowedRoles: MaintenanceAllowedRole[];
  targetUserScope: "all" | "specific";
  targetUserIds: Types.ObjectId[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceModeSchema = new Schema<IMaintenanceModeDocument>(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      default: "global",
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      default: "Estamos realizando tareas de mantenimiento. Vuelve a intentar en unos minutos.",
    },
    subtitle: {
      type: String,
      required: false,
      trim: true,
      default: "Estamos haciendo ajustes para mejorar el sistema.",
    },
    allowedRoles: {
      type: [
        {
          type: String,
          enum: ["admin", "operator", "seller"],
        },
      ],
      default: [],
    },
    targetUserScope: {
      type: String,
      enum: ["all", "specific"],
      default: "all",
    },
    targetUserIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    collection: "MaintenanceMode",
    timestamps: true,
  }
);

MaintenanceModeSchema.index({ configKey: 1 }, { unique: true });

export const MaintenanceModeModel = model<IMaintenanceModeDocument>(
  "MaintenanceMode",
  MaintenanceModeSchema
);
