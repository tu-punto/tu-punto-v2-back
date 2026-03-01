import { Document, Schema, Types, model } from "mongoose";

export interface IProductVariantQRDocument extends Document {
  productId: Types.ObjectId;
  variantKey: string;
  variantLabel: string;
  variantes: Map<string, string>;
  qrCode: string;
  qrPayload: string;
  qrImagePath: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantQRSchema = new Schema<IProductVariantQRDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Producto",
      required: true
    },
    variantKey: {
      type: String,
      required: true
    },
    variantLabel: {
      type: String,
      required: true
    },
    variantes: {
      type: Map,
      of: String,
      required: true
    },
    qrCode: {
      type: String,
      required: true,
      unique: true
    },
    qrPayload: {
      type: String,
      required: true
    },
    qrImagePath: {
      type: String,
      required: true
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    collection: "ProductVariantQR",
    timestamps: true
  }
);

ProductVariantQRSchema.index({ productId: 1, variantKey: 1 }, { unique: true });
ProductVariantQRSchema.index({ qrCode: 1 }, { unique: true });

export const ProductVariantQRModel = model<IProductVariantQRDocument>(
  "ProductVariantQR",
  ProductVariantQRSchema
);

