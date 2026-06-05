import { Types } from "mongoose";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { TrackingFreezeConfigModel } from "../entities/implements/TrackingFreezeConfigSchema";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { calculateLatePickupFee, resolveBranchPickupFeeStart } from "../utils/latePickupFee";
import { TrackingTimelineService, PublicTrackingStatus } from "./trackingTimeline.service";

const CONFIG_KEY = "external_simple_delivery";

const toTrimmed = (value: unknown) => String(value ?? "").trim();

const isDeliveredFilter = { estado_pedido: "Entregado" };

const pendingStatusFilter = {
  estado_pedido: { $ne: "Entregado" },
};

const pedidoDeliveryFilter = {
  simple_package_order: true,
  lugar_origen: { $exists: true, $ne: null },
  sucursal: { $exists: true, $ne: null },
  $expr: { $ne: ["$lugar_origen", "$sucursal"] },
};

const externalDeliveryFilter = {
  $or: [
    { service_origin: { $exists: false } },
    { service_origin: "external" },
    { service_origin: "simple_package" },
  ],
  origen_sucursal: { $exists: true, $ne: null },
  destino_sucursal: { $exists: true, $ne: null },
  $expr: { $ne: ["$origen_sucursal", "$destino_sucursal"] },
};

const getConfig = async () => {
  const now = new Date();
  return await TrackingFreezeConfigModel.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      $setOnInsert: {
        key: CONFIG_KEY,
        enabled: false,
        updated_at: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
};

const isEnabled = async () => {
  const config = await getConfig();
  return config?.enabled === true;
};

const isDeliveryByBranches = (originBranchId?: unknown, destinationBranchId?: unknown) => {
  const originId = toTrimmed((originBranchId as any)?._id ?? originBranchId);
  const destinationId = toTrimmed((destinationBranchId as any)?._id ?? destinationBranchId);
  return Boolean(originId && destinationId && originId !== destinationId);
};

const getFreezeFieldsForOrder = async (params: {
  originBranchId?: unknown;
  destinationBranchId?: unknown;
}) => {
  if (!isDeliveryByBranches(params.originBranchId, params.destinationBranchId)) {
    return {};
  }

  if (!(await isEnabled())) {
    return {};
  }

  const now = new Date();
  return {
    public_tracking_schedule_base_at: now,
    public_tracking_frozen: true,
    public_tracking_frozen_status: "RECEPTION" as PublicTrackingStatus,
    public_tracking_frozen_at: now,
  };
};

const buildFrozenBulkUpdates = (rows: any[], now: Date) =>
  rows.map((row) => {
    const status = TrackingTimelineService.buildPublicTracking(row, now).status;
    const frozenLatePickupFee = Math.max(
      Number(row?.late_pickup_fee || 0),
      calculateLatePickupFee({
        startAt: resolveBranchPickupFeeStart(row),
        pickedUpAt: now,
      })
    );
    return {
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            public_tracking_frozen: true,
            public_tracking_frozen_status: status,
            public_tracking_frozen_at: now,
            late_pickup_fee: frozenLatePickupFee,
          },
        },
      },
    };
  });

const freezeExistingOrders = async (now: Date) => {
  const [pedidos, externas] = await Promise.all([
    PedidoModel.find({
      ...pedidoDeliveryFilter,
      ...pendingStatusFilter,
    }).lean(),
    VentaExternaModel.find({
      ...externalDeliveryFilter,
      ...pendingStatusFilter,
    }).lean(),
  ]);

  const pedidoOps = buildFrozenBulkUpdates(pedidos, now);
  const externalOps = buildFrozenBulkUpdates(externas, now);

  const [pedidoResult, externalResult] = await Promise.all([
    pedidoOps.length ? PedidoModel.bulkWrite(pedidoOps as any[]) : Promise.resolve({ modifiedCount: 0 }),
    externalOps.length ? VentaExternaModel.bulkWrite(externalOps as any[]) : Promise.resolve({ modifiedCount: 0 }),
  ]);

  return {
    pedidos: Number((pedidoResult as any)?.modifiedCount || 0),
    externas: Number((externalResult as any)?.modifiedCount || 0),
  };
};

const unfreezeExistingOrders = async (now: Date) => {
  const pendingUpdate = {
    $set: {
      public_tracking_frozen: false,
      public_tracking_schedule_base_at: now,
    },
    $unset: {
      public_tracking_frozen_status: "",
      public_tracking_frozen_at: "",
    },
  };
  const deliveredUpdate = {
    $set: {
      public_tracking_frozen: false,
    },
    $unset: {
      public_tracking_frozen_status: "",
      public_tracking_frozen_at: "",
    },
  };

  const [pendingPedidos, pendingExternas, deliveredPedidos, deliveredExternas] = await Promise.all([
    PedidoModel.updateMany(
      { ...pedidoDeliveryFilter, ...pendingStatusFilter, public_tracking_frozen: true },
      pendingUpdate
    ),
    VentaExternaModel.updateMany(
      { ...externalDeliveryFilter, ...pendingStatusFilter, public_tracking_frozen: true },
      pendingUpdate
    ),
    PedidoModel.updateMany(
      { ...pedidoDeliveryFilter, ...isDeliveredFilter, public_tracking_frozen: true },
      deliveredUpdate
    ),
    VentaExternaModel.updateMany(
      { ...externalDeliveryFilter, ...isDeliveredFilter, public_tracking_frozen: true },
      deliveredUpdate
    ),
  ]);

  return {
    pedidos:
      Number((pendingPedidos as any)?.modifiedCount || 0) +
      Number((deliveredPedidos as any)?.modifiedCount || 0),
    externas:
      Number((pendingExternas as any)?.modifiedCount || 0) +
      Number((deliveredExternas as any)?.modifiedCount || 0),
  };
};

const setEnabled = async (enabled: boolean, userId?: string) => {
  const current = await getConfig();
  const now = new Date();
  const wasEnabled = current?.enabled === true;

  if (wasEnabled === enabled) {
    return {
      config: current,
      changed: false,
      affected: { pedidos: 0, externas: 0 },
    };
  }

  const affected = enabled ? await freezeExistingOrders(now) : await unfreezeExistingOrders(now);

  const update: any = {
    enabled,
    updated_at: now,
  };

  if (enabled) {
    update.activated_at = now;
  } else {
    update.deactivated_at = now;
  }

  if (userId && Types.ObjectId.isValid(userId)) {
    update.updated_by = new Types.ObjectId(userId);
  }

  const config = await TrackingFreezeConfigModel.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      $set: update,
      $setOnInsert: { key: CONFIG_KEY },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return {
    config,
    changed: true,
    affected,
  };
};

export const TrackingFreezeService = {
  getConfig,
  isEnabled,
  getFreezeFieldsForOrder,
  setEnabled,
};
