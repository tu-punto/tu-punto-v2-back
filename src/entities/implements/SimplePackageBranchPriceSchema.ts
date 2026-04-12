import { Schema, model, Types } from "mongoose";

const SimplePackageBranchPriceSchema = new Schema(
  {
    origen_sucursal: {
      type: Types.ObjectId,
      ref: "Sucursal",
      required: true,
    },
    destino_sucursal: {
      type: Types.ObjectId,
      ref: "Sucursal",
      required: true,
    },
    precio: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    collection: "SimplePackageBranchPrice",
    timestamps: false,
  }
);

SimplePackageBranchPriceSchema.index(
  { origen_sucursal: 1, destino_sucursal: 1 },
  { unique: true, name: "simple_package_branch_price_unique_route" }
);

export const SimplePackageBranchPriceModel = model(
  "SimplePackageBranchPrice",
  SimplePackageBranchPriceSchema
);
