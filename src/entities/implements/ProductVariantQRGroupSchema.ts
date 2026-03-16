import { Document, Schema, Types, model } from "mongoose";

export interface IProductVariantQRGroupItem {
  productId: Types.ObjectId;
  variantKey: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
}

export interface IProductVariantQRGroupDocument extends Document {
  name: string;
  sellerId: Types.ObjectId;
  groupCode: string;
  qrPayload: string;
  qrImagePath: string;
  items: IProductVariantQRGroupItem[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantQRGroupItemSchema = new Schema<IProductVariantQRGroupItem>(
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
    productNameSnapshot: {
      type: String,
      required: true
    },
    variantLabelSnapshot: {
      type: String,
      required: true
    }
  },
  {
    _id: false
  }
);

const ProductVariantQRGroupSchema = new Schema<IProductVariantQRGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Vendedor",
      required: true
    },
    groupCode: {
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
      default: ""
    },
    items: {
      type: [ProductVariantQRGroupItemSchema],
      default: []
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    collection: "ProductVariantQRGroup",
    timestamps: true
  }
);

ProductVariantQRGroupSchema.index({ sellerId: 1, active: 1, updatedAt: -1 });
ProductVariantQRGroupSchema.index({ groupCode: 1 }, { unique: true });

export const ProductVariantQRGroupModel = model<IProductVariantQRGroupDocument>(
  "ProductVariantQRGroup",
  ProductVariantQRGroupSchema
);
