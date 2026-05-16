import { Types } from "mongoose";

export type PackageEscalationServiceOrigin = "external" | "simple_package" | "delivery";

export interface IPackageEscalationRange {
  from: number;
  to?: number | null;
  small_price: number;
  large_price: number;
}

export interface IPackageDeliverySpace {
  size: string;
  spaces: number;
}

export interface IPackageEscalationConfig {
  _id?: Types.ObjectId;
  route?: Types.ObjectId;
  sucursal?: Types.ObjectId;
  service_origin: PackageEscalationServiceOrigin;
  ranges: IPackageEscalationRange[];
  delivery_spaces?: IPackageDeliverySpace[];
  updated_at?: Date;
}
