import { Schema, Types, model } from "mongoose";

export type ActionTraceStatus = "success" | "failed";

export interface IActionTraceDocument {
  _id: Types.ObjectId;
  action_type: string;
  source_module: string;
  source_id: string;
  entity_type?: string;
  entity_id?: Types.ObjectId;
  entity_label?: string;
  actor_user_id?: Types.ObjectId;
  actor_role?: string;
  actor_name?: string;
  seller_id?: Types.ObjectId;
  seller_name?: string;
  branch_id?: Types.ObjectId;
  branch_name?: string;
  status: ActionTraceStatus;
  failure_category?: string;
  failure_message?: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

const ActionTraceSchema = new Schema<IActionTraceDocument>(
  {
    action_type: { type: String, required: true, trim: true },
    source_module: { type: String, required: true, trim: true },
    source_id: { type: String, default: "", trim: true },
    entity_type: { type: String, default: "", trim: true },
    entity_id: { type: Schema.Types.ObjectId, required: false, ref: "Mixed" },
    entity_label: { type: String, default: "", trim: true },
    actor_user_id: { type: Schema.Types.ObjectId, ref: "User", required: false },
    actor_role: { type: String, default: "", trim: true },
    actor_name: { type: String, default: "", trim: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "Vendedor", required: false },
    seller_name: { type: String, default: "", trim: true },
    branch_id: { type: Schema.Types.ObjectId, ref: "Sucursal", required: false },
    branch_name: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
      required: true,
    },
    failure_category: { type: String, default: "", trim: true },
    failure_message: { type: String, default: "", trim: true },
    summary: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "ActionTrace",
    timestamps: false,
  }
);

ActionTraceSchema.index({ created_at: -1 });
ActionTraceSchema.index({ action_type: 1, created_at: -1 });
ActionTraceSchema.index({ source_module: 1, created_at: -1 });
ActionTraceSchema.index({ actor_user_id: 1, created_at: -1 });
ActionTraceSchema.index({ status: 1, created_at: -1 });

export const ActionTraceModel = model<IActionTraceDocument>("ActionTrace", ActionTraceSchema);
