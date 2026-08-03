import { Document, Types } from "mongoose";
import { IInventoryAuditEvent } from "../IInventoryAuditEvent";

export interface IInventoryAuditEventDocument extends IInventoryAuditEvent, Document {
  _id: Types.ObjectId;
}
