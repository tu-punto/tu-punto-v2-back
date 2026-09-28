import { Schema, model } from "mongoose";

const DynamicQRSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    destinationUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "DynamicQR" }
);

DynamicQRSchema.index({ name: "text", code: "text" });

export const DynamicQRModel = model("DynamicQR", DynamicQRSchema);
