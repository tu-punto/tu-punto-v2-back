import { Schema, model } from "mongoose";
import { IPackageEscalationConfig } from "../IPackageEscalationConfig";

const PackageEscalationRangeSchema = new Schema(
  {
    from: { type: Number, required: true, min: 1 },
    to: { type: Number, required: false, default: null },
    small_price: { type: Number, required: true, min: 0, default: 0 },
    large_price: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const PackageDeliverySpaceSchema = new Schema(
  {
    size: { type: String, required: true, trim: true },
    spaces: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const PackageEscalationConfigSchema = new Schema(
  {
    route: {
      type: Schema.Types.ObjectId,
      ref: "SimplePackageBranchPrice",
      required: false,
      index: true,
    },
    sucursal: {
      type: Schema.Types.ObjectId,
      ref: "Sucursal",
      required: false,
      index: true,
    },
    service_origin: {
      type: String,
      enum: ["external", "simple_package", "delivery"],
      required: true,
      index: true,
    },
    ranges: {
      type: [PackageEscalationRangeSchema],
      default: [],
    },
    external_pricing: {
      small_price: { type: Number, required: false, min: 0, default: 0 },
      large_price: { type: Number, required: false, min: 0, default: 0 },
      weekly_fee: { type: Number, required: false, min: 0, default: 0 },
      fee_cap: { type: Number, required: false, min: 0, default: 0 },
    },
    delivery_spaces: {
      type: [PackageDeliverySpaceSchema],
      default: undefined,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "PackageEscalationConfig",
    timestamps: false,
  }
);

PackageEscalationConfigSchema.index(
  { route: 1, service_origin: 1 },
  { unique: true, partialFilterExpression: { route: { $exists: true } } }
);

export const PackageEscalationConfigModel = model<IPackageEscalationConfig>(
  "PackageEscalationConfig",
  PackageEscalationConfigSchema
);
