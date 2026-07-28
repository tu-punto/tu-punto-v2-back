import { Types } from "mongoose";

export interface IInventoryAuditMovement {
  event_id: Types.ObjectId;
  event_type: string;
  source_module: string;
  source_id?: string;
  correlation_id?: string;
  product_id?: Types.ObjectId;
  product_name_snapshot: string;
  variant_key?: string;
  variant_label_snapshot?: string;
  variant_attributes_snapshot?: Record<string, string>;
  seller_id?: Types.ObjectId;
  seller_name?: string;
  branch_id?: Types.ObjectId;
  branch_name?: string;
  stock_before: number;
  stock_delta: number;
  stock_after: number;
  movement_direction: "in" | "out" | "neutral";
  performed_at: Date;
  created_at: Date;
}
