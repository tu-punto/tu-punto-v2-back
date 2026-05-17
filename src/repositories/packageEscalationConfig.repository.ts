import { Types } from "mongoose";
import { PackageEscalationServiceOrigin } from "../entities/IPackageEscalationConfig";
import { PackageEscalationConfigModel } from "../entities/implements/PackageEscalationConfigSchema";

let legacyIndexCleanupPromise: Promise<void> | null = null;

const ensureLegacySucursalOriginIndexRemoved = async () => {
  if (!legacyIndexCleanupPromise) {
    legacyIndexCleanupPromise = (async () => {
      try {
        const indexes = await PackageEscalationConfigModel.collection.indexes();
        const legacyIndex = indexes.find(
          (index: any) => index?.name === "sucursal_1_service_origin_1" && index?.unique === true
        );

        if (legacyIndex) {
          await PackageEscalationConfigModel.collection.dropIndex("sucursal_1_service_origin_1");
        }
      } catch (error: any) {
        if (error?.codeName === "IndexNotFound" || error?.code === 27) return;
        console.warn("No se pudo quitar el indice legacy de escalonamiento:", error?.message || error);
      }
    })();
  }

  return legacyIndexCleanupPromise;
};

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

const findGlobalByOrigin = async (serviceOrigin: PackageEscalationServiceOrigin) => {
  return await PackageEscalationConfigModel.findOne({
    service_origin: serviceOrigin,
    sucursal: null,
    route: null,
  }).lean();
};

const upsertGlobalByOrigin = async (params: {
  serviceOrigin: PackageEscalationServiceOrigin;
  ranges: any[];
  deliverySpaces?: any[];
}) => {
  await ensureLegacySucursalOriginIndexRemoved();

  const existing = await PackageEscalationConfigModel.findOne({
    service_origin: params.serviceOrigin,
    sucursal: null,
    route: null,
  });
  const updatePayload: any = {
    service_origin: params.serviceOrigin,
    ranges: params.ranges,
    updated_at: new Date(),
  };
  if (params.deliverySpaces !== undefined) {
    updatePayload.delivery_spaces = params.deliverySpaces;
  }

  if (existing) {
    existing.set(updatePayload);
    existing.set("route", undefined);
    existing.set("sucursal", undefined);
    return await existing.save();
  }

  return await PackageEscalationConfigModel.create({
    ...updatePayload,
    route: undefined,
    sucursal: undefined,
  });
};

const upsertByRouteAndOrigin = async (params: {
  routeId: string;
  serviceOrigin: PackageEscalationServiceOrigin;
  ranges: any[];
  deliverySpaces?: any[];
}) => {
  await ensureLegacySucursalOriginIndexRemoved();

  const updatePayload: any = {
    route: new Types.ObjectId(params.routeId),
    service_origin: params.serviceOrigin,
    ranges: params.ranges,
    updated_at: new Date(),
  };
  if (params.deliverySpaces !== undefined) {
    updatePayload.delivery_spaces = params.deliverySpaces;
  }

  return await PackageEscalationConfigModel.findOneAndUpdate(
    {
      route: new Types.ObjectId(params.routeId),
      service_origin: params.serviceOrigin,
    },
    updatePayload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate({ path: "sucursal", select: "_id nombre" });
};

export const PackageEscalationConfigRepository = {
  listConfigs,
  findByRouteAndOrigin,
  findGlobalByOrigin,
  upsertGlobalByOrigin,
  upsertByRouteAndOrigin,
};
