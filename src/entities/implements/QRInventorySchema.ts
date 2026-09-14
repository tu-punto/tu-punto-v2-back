import { Schema, Types, model } from "mongoose";

const QRInventoryRowSchema = new Schema({
  productId: { type: Types.ObjectId, ref: "Producto", required: true },
  sellerId: { type: Types.ObjectId, ref: "Vendedor", required: false },
  productName: { type: String, required: true },
  categoryName: { type: String, default: "" },
  variantKey: { type: String, required: true },
  variantLabel: { type: String, default: "" },
  variantes: { type: Map, of: String, default: {} },
  price: { type: Number, default: 0 },
  initialStock: { type: Number, required: true, default: 0 },
  countedStock: { type: Number, required: true, default: 0 },
  lastModifiedAt: { type: Date, required: true, default: Date.now },
  lastModifiedBy: { type: Types.ObjectId, ref: "User", required: false },
  lastModifiedByName: { type: String, default: "" },
}, { _id: true });

const QRInventorySchema = new Schema({
  sucursalId: { type: Types.ObjectId, ref: "Sucursal", required: true, index: true },
  status: { type: String, enum: ["open", "paused", "closed"], default: "open", index: true },
  createdBy: { type: Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, default: "" },
  startedAt: { type: Date, required: true, default: Date.now },
  pausedAt: { type: Date },
  closedAt: { type: Date },
  closedBy: { type: Types.ObjectId, ref: "User" },
  closedByName: { type: String, default: "" },
  version: { type: Number, required: true, default: 1 },
  stockSnapshot: { type: [new Schema({ productId: Types.ObjectId, variantKey: String, stock: Number }, { _id: false })], default: [] },
  rows: { type: [QRInventoryRowSchema], default: [] },
}, { collection: "QRInventory", timestamps: true });

QRInventorySchema.index({ sucursalId: 1, status: 1 });
QRInventorySchema.index({ sucursalId: 1, updatedAt: -1 });

export const QRInventoryModel = model<any>("QRInventory", QRInventorySchema);

export const QRInventoryEventModel = model<any>("QRInventoryEvent", new Schema({
  inventoryId: { type: Types.ObjectId, ref: "QRInventory", required: true, index: true },
  rowId: { type: Types.ObjectId, required: false },
  type: { type: String, enum: ["scan", "correction", "created", "paused", "resumed", "closed"], required: true },
  actorId: { type: Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, default: "" },
  previousCount: { type: Number },
  nextCount: { type: Number },
  reason: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { collection: "QRInventoryEvent", timestamps: false }));
