import { Schema, model } from "mongoose";

const FarmerDiscountRuleSchema = new Schema(
  {
    limite_inferior: { type: Number, required: true, min: 0 },
    limite_superior: { type: Number, required: true, min: 0 },
    monto_descontado: { type: Number, required: true, min: 0 },
    monto_para_tu_punto: { type: Number, required: true, min: 0 },
  },
  { collection: "FarmerDiscountRule", timestamps: true }
);

FarmerDiscountRuleSchema.index({ limite_inferior: 1, limite_superior: 1 });
export const FarmerDiscountRuleModel = model("FarmerDiscountRule", FarmerDiscountRuleSchema);
