import { Types } from "mongoose";
import { PackageEscalationServiceOrigin } from "../entities/IPackageEscalationConfig";
import { PackageEscalationConfigModel } from "../entities/implements/PackageEscalationConfigSchema";

const listConfigs = async (routeId?: string) => {
  const match: any = {};
  if (routeId && Types.ObjectId.isValid(routeId)) {
    match.route = new Types.ObjectId(routeId);
  }

  return await PackageEscalationConfigModel.find(match)
    .sort({ service_origin: 1 })
    .populate({
      path: "route",
      populate: [
        { path: "origen_sucursal", select: "_id nombre" },
        { path: "destino_sucursal", select: "_id nombre" },
      ],
    })
    .populate({ path: "sucursal", select: "_id nombre" })
    .lean();
};

const findByRouteAndOrigin = async (routeId: string, serviceOrigin: PackageEscalationServiceOrigin) => {
  if (!Types.ObjectId.isValid(routeId)) return null;

  return await PackageEscalationConfigModel.findOne({
    route: new Types.ObjectId(routeId),
    service_origin: serviceOrigin,
  }).lean();
};

const upsertByRouteAndOrigin = async (params: {
  routeId: string;
  serviceOrigin: PackageEscalationServiceOrigin;
  ranges: any[];
}) => {
  return await PackageEscalationConfigModel.findOneAndUpdate(
    {
      route: new Types.ObjectId(params.routeId),
      service_origin: params.serviceOrigin,
    },
    {
      route: new Types.ObjectId(params.routeId),
      service_origin: params.serviceOrigin,
      ranges: params.ranges,
      updated_at: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate({ path: "sucursal", select: "_id nombre" });
};

export const PackageEscalationConfigRepository = {
  listConfigs,
  findByRouteAndOrigin,
  upsertByRouteAndOrigin,
};
