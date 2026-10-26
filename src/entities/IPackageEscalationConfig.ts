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

export interface IExternalPackagePricing {
  small_price: number;
  large_price: number;
  weekly_fee: number;
  fee_cap: number;
}

export interface IPackageEscalationConfig {
  _id?: Types.ObjectId;
  route?: Types.ObjectId;
  sucursal?: Types.ObjectId;
  service_origin: PackageEscalationServiceOrigin;
  ranges: IPackageEscalationRange[];
  external_pricing?: IExternalPackagePricing;
  delivery_spaces?: IPackageDeliverySpace[];
  updated_at?: Date;
}
