import { Types } from "mongoose";

export type PackageEscalationServiceOrigin = "external" | "simple_package";

export interface IPackageEscalationRange {
  from: number;
  to?: number | null;
  small_price: number;
  large_price: number;
}

export interface IPackageEscalationConfig {
  _id?: Types.ObjectId;
  route?: Types.ObjectId;
  sucursal?: Types.ObjectId;
  service_origin: PackageEscalationServiceOrigin;
  ranges: IPackageEscalationRange[];
  updated_at?: Date;
}
