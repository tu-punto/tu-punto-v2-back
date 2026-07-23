import { Schema, model } from "mongoose";

const PromotionTierSchema = new Schema(
  {
    minQuantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true }
  },
  { _id: false }
);

const ProductPromotionSchema = new Schema(
  {
    id_vendedor: {
      type: Schema.Types.ObjectId,
      ref: "Vendedor",
      required: true,
      index: true
    },
    id_producto: {
      type: Schema.Types.ObjectId,
      ref: "Producto",
      required: true,
      index: true
    },
    variantKey: {
      type: String,
      required: true,
      index: true
    },
    scope: {
      type: String,
      enum: ["interno", "catalogo", "ambos"],
      required: true,
      index: true
    },
    titulo: {
      type: String,
      default: ""
    },
    precio_simple: {
      type: Number,
      required: false
    },
    escalas: {
      type: [PromotionTierSchema],
      default: []
    },
    fecha_inicio: {
      type: Date,
      required: true,
      index: true
    },
    fecha_fin: {
      type: Date,
      required: true,
      index: true
    },
    estado: {
      type: String,
      enum: ["draft", "active", "disabled"],
      default: "active",
      index: true
    }
  },
  {
    timestamps: true,
    collection: "ProductPromotion"
  }
);

ProductPromotionSchema.index({
  id_vendedor: 1,
  id_producto: 1,
  variantKey: 1,
  scope: 1,
  fecha_inicio: 1,
  fecha_fin: 1
});

export const ProductPromotionModel = model("ProductPromotion", ProductPromotionSchema);
