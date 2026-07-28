import { Schema, model } from "mongoose";
import { IInventoryAuditMovementDocument } from "../documents/IInventoryAuditMovementDocument";

const InventoryAuditMovementSchema = new Schema<IInventoryAuditMovementDocument>(
  {
    event_id: { type: Schema.Types.ObjectId, ref: "InventoryAuditEvent", required: true },
    event_type: { type: String, required: true, trim: true },
    source_module: { type: String, required: true, trim: true },
    source_id: { type: String, default: "", trim: true },
    correlation_id: { type: String, default: "", trim: true },
    product_id: { type: Schema.Types.ObjectId, ref: "Producto", required: false },
    product_name_snapshot: { type: String, required: true, trim: true },
    variant_key: { type: String, default: "", trim: true },
    variant_label_snapshot: { type: String, default: "", trim: true },
    variant_attributes_snapshot: { type: Map, of: String, required: false },
    seller_id: { type: Schema.Types.ObjectId, ref: "Vendedor", required: false },
    seller_name: { type: String, default: "", trim: true },
    branch_id: { type: Schema.Types.ObjectId, ref: "Sucursal", required: false },
    branch_name: { type: String, default: "", trim: true },
    stock_before: { type: Number, required: true },
    stock_delta: { type: Number, required: true },
    stock_after: { type: Number, required: true },
    movement_direction: {
      type: String,
      enum: ["in", "out", "neutral"],
      required: true,
      default: "neutral",
    },
    performed_at: { type: Date, required: true, default: Date.now },
    created_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "InventoryAuditMovement",
    timestamps: false,
  }
);

InventoryAuditMovementSchema.index({ created_at: -1 });
InventoryAuditMovementSchema.index({ product_id: 1, created_at: -1 });
InventoryAuditMovementSchema.index({ seller_id: 1, created_at: -1 });
InventoryAuditMovementSchema.index({ branch_id: 1, created_at: -1 });
InventoryAuditMovementSchema.index({ event_type: 1, created_at: -1 });
InventoryAuditMovementSchema.index({ correlation_id: 1 });
InventoryAuditMovementSchema.index({ event_id: 1 });

export const InventoryAuditMovementModel = model<IInventoryAuditMovementDocument>(
  "InventoryAuditMovement",
  InventoryAuditMovementSchema
);
