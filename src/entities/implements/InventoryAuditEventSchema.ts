import { Schema, Types, model } from "mongoose";
import { IInventoryAuditEventDocument } from "../documents/IInventoryAuditEventDocument";

const InventoryAuditEventSchema = new Schema<IInventoryAuditEventDocument>(
  {
    event_type: { type: String, required: true, trim: true },
    source_module: { type: String, required: true, trim: true },
    source_id: { type: String, default: "", trim: true },
    correlation_id: { type: String, default: "", trim: true },
    actor_user_id: { type: Types.ObjectId, ref: "User", required: false },
    actor_role: { type: String, default: "", trim: true },
    actor_name: { type: String, default: "", trim: true },
    seller_id: { type: Types.ObjectId, ref: "Vendedor", required: false },
    seller_name: { type: String, default: "", trim: true },
    branch_id: { type: Types.ObjectId, ref: "Sucursal", required: false },
    branch_name: { type: String, default: "", trim: true },
    comment: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    audit_status: {
      type: String,
      enum: ["recorded", "failed_partial"],
      default: "recorded",
      required: true,
    },
    movement_count: { type: Number, required: true, default: 0 },
    created_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "InventoryAuditEvent",
    timestamps: false,
  }
);

InventoryAuditEventSchema.index({ created_at: -1 });
InventoryAuditEventSchema.index({ event_type: 1, created_at: -1 });
InventoryAuditEventSchema.index({ source_id: 1 });
InventoryAuditEventSchema.index({ actor_user_id: 1, created_at: -1 });

export const InventoryAuditEventModel = model<IInventoryAuditEventDocument>(
  "InventoryAuditEvent",
  InventoryAuditEventSchema
);
