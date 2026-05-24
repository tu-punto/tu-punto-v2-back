import { Types } from "mongoose";

export interface ITrackingFreezeConfig {
  _id?: Types.ObjectId;
  key: string;
  enabled: boolean;
  activated_at?: Date;
  deactivated_at?: Date;
  updated_at: Date;
  updated_by?: Types.ObjectId;
}
