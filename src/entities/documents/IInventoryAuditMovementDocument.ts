import { Document, Types } from "mongoose";
import { IInventoryAuditMovement } from "../IInventoryAuditMovement";

export interface IInventoryAuditMovementDocument extends IInventoryAuditMovement, Document {
  _id: Types.ObjectId;
}
