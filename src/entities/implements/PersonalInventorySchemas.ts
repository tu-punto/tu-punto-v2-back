import { Schema, model, Types } from "mongoose";

const owned = { type: Schema.Types.ObjectId, ref: "Vendedor", required: true, index: true };

export const PersonalProductModel = model("PersonalProduct", new Schema({
  sellerId: owned,
  name: { type: String, required: true, trim: true },
  salePrice: { type: Number, required: true, min: 0 },
  purchaseCost: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true, collection: "PersonalProduct" }));

export const PersonalSaleModel = model("PersonalSale", new Schema({
  sellerId: owned,
  total: { type: Number, required: true, min: 0 },
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: "PersonalProduct", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  }],
}, { timestamps: true, collection: "PersonalSale" }));

export const PersonalExpenseModel = model("PersonalExpense", new Schema({
  sellerId: owned,
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, required: true, trim: true },
  occurredAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true, collection: "PersonalExpense" }));

export const PersonalInventoryMovementModel = model("PersonalInventoryMovement", new Schema({
  sellerId: owned,
  productId: { type: Schema.Types.ObjectId, ref: "PersonalProduct", required: true, index: true },
  type: { type: String, enum: ["initial", "adjustment", "sale"], required: true },
  quantityDelta: { type: Number, required: true },
  reason: { type: String, trim: true },
  saleId: { type: Schema.Types.ObjectId, ref: "PersonalSale" },
}, { timestamps: true, collection: "PersonalInventoryMovement" }));

PersonalProductModel.schema.index({ sellerId: 1, name: 1 });
PersonalSaleModel.schema.index({ sellerId: 1, createdAt: -1 });
PersonalExpenseModel.schema.index({ sellerId: 1, occurredAt: -1 });
PersonalInventoryMovementModel.schema.index({ sellerId: 1, createdAt: -1 });

export const isObjectId = (value: string) => Types.ObjectId.isValid(value);
