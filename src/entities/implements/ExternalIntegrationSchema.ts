import { Schema, model, Types } from "mongoose";

const ExternalIntegrationSchema = new Schema({
  sellerId: { type: Types.ObjectId, ref: "Vendedor", required: true, index: true },
  name: { type: String, required: true, trim: true },
  keyHash: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true },
  active: { type: Boolean, default: true },
  lastUsedAt: { type: Date }
}, { timestamps: true, collection: "ExternalIntegration" });

const ExternalIntegrationDeliverySchema = new Schema({
  integrationId: { type: Types.ObjectId, ref: "ExternalIntegration", required: true },
  externalOrderId: { type: String, required: true },
  fingerprint: { type: String, required: true },
  type: { type: String, enum: ["stock", "simple"], required: true },
  shippingId: { type: Types.ObjectId, ref: "Pedido" },
  packageId: { type: Types.ObjectId, ref: "VentaExterna" },
  status: { type: String, enum: ["success", "failed"], required: true },
  error: { type: String, default: "" }
}, { timestamps: true, collection: "ExternalIntegrationDelivery" });
ExternalIntegrationDeliverySchema.index({ integrationId: 1, externalOrderId: 1 }, { unique: true });

export const ExternalIntegrationModel = model("ExternalIntegration", ExternalIntegrationSchema);
export const ExternalIntegrationDeliveryModel = model("ExternalIntegrationDelivery", ExternalIntegrationDeliverySchema);
