import { Types } from "mongoose";

export interface IInventoryAuditEvent {
  event_type: string;
  source_module: string;
  source_id?: string;
  correlation_id?: string;
  actor_user_id?: Types.ObjectId;
  actor_role?: string;
  actor_name?: string;
  seller_id?: Types.ObjectId;
  seller_name?: string;
  branch_id?: Types.ObjectId;
  branch_name?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  audit_status: "recorded" | "failed_partial";
  movement_count: number;
  created_at: Date;
}
