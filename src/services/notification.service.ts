import { Types } from "mongoose";
import { NotificationModel } from "../entities/implements/NotificationSchema";
import { PushSubscriptionModel } from "../entities/implements/PushSubscriptionSchema";
import { UserModel } from "../entities/implements/UserSchema";
import { PedidoModel } from "../entities/implements/PedidoSchema";

type WebPushModule = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    payload?: string
  ): Promise<unknown>;
};

const webpush = require("web-push") as WebPushModule;

const INTERNAL_NOTIFICATION_ROLES = ["admin", "operator", "seller"] as const;
const INTERNAL_RECIPIENT_ROLES = ["admin", "operator", "superadmin"] as const;
const BUYER_STATUSES = {
  CONFIRMED: "En Espera",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
} as const;

type InternalRole = (typeof INTERNAL_NOTIFICATION_ROLES)[number];
type InternalRecipientRole = (typeof INTERNAL_RECIPIENT_ROLES)[number];

type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type ShippingLike = {
  _id?: unknown;
  cliente?: unknown;
  estado_pedido?: unknown;
  hora_entrega_acordada?: unknown;
  lugar_entrega?: unknown;
  buyer_tracking_code?: unknown;
  shipping_qr_code?: unknown;
  sucursal?: unknown;
  lugar_origen?: unknown;
};

type NotifyUsersParams = {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  role?: InternalRole;
  shippingId?: string;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  urlPath?: string;
  pushTag?: string;
};

const PUSH_VAPID_PUBLIC_KEY = String(process.env.PUSH_VAPID_PUBLIC_KEY || "").trim();
const PUSH_VAPID_PRIVATE_KEY = String(process.env.PUSH_VAPID_PRIVATE_KEY || "").trim();
const PUSH_VAPID_SUBJECT = String(process.env.PUSH_VAPID_SUBJECT || "mailto:admin@example.com").trim();
const CLIENT_URL = String(
  process.env.CLIENT_URL || process.env.CLIENT_URL_2 || "http://localhost:5173"
).trim();

let reminderTimer: NodeJS.Timeout | null = null;

const pushConfigured = Boolean(
  PUSH_VAPID_PUBLIC_KEY && PUSH_VAPID_PRIVATE_KEY && PUSH_VAPID_SUBJECT
);

if (pushConfigured) {
  webpush.setVapidDetails(PUSH_VAPID_SUBJECT, PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY);
} else {
  console.warn(
    "[notifications] Push deshabilitado: faltan PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY / PUSH_VAPID_SUBJECT"
  );
}

const toStringValue = (value: unknown): string => String(value ?? "").trim();

const normalizeInternalRole = (role: unknown): InternalRole | "" => {
  const normalizedRole = toStringValue(role).toLowerCase();
  if (normalizedRole === "superadmin") return "admin";
  if (
    normalizedRole === "admin" ||
    normalizedRole === "operator" ||
    normalizedRole === "seller"
  ) {
    return normalizedRole;
  }
  return "";
};

const resolveObjectId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const maybeObject = value as Record<string, unknown>;
    return String(maybeObject._id || maybeObject.$oid || "");
  }
  return "";
};

const resolveBranchIdFromShipping = (shipping: ShippingLike): string => {
  return resolveObjectId(shipping?.sucursal) || resolveObjectId(shipping?.lugar_origen);
};

const buildHashUrl = (hashPath: string): string => {
  const base = CLIENT_URL.replace(/\/+$/, "");
  const normalizedHash = hashPath.startsWith("/") ? hashPath : `/${hashPath}`;
  return `${base}/#${normalizedHash}`;
};

const getPushIconUrl = (): string => `${CLIENT_URL.replace(/\/+$/, "")}/logo-no-letter.png`;

const normalizePushSubscription = (subscription: unknown): BrowserPushSubscription => {
  const endpoint = toStringValue((subscription as any)?.endpoint);
  const p256dh = toStringValue((subscription as any)?.keys?.p256dh);
  const auth = toStringValue((subscription as any)?.keys?.auth);

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Suscripcion push invalida");
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
};

const createInAppNotifications = async (params: {
  userIds: string[];
  role?: InternalRole;
  shippingId?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  dedupeKey?: string;
}) => {
  const createdForUserIds: string[] = [];

  for (const userId of params.userIds) {
    if (!Types.ObjectId.isValid(userId)) continue;

    try {
      await NotificationModel.create({
        userId: new Types.ObjectId(userId),
        shippingId: params.shippingId && Types.ObjectId.isValid(params.shippingId)
          ? new Types.ObjectId(params.shippingId)
          : undefined,
        type: params.type,
        title: params.title,
        body: params.body,
        role: params.role,
        data: params.data,
        dedupeKey: params.dedupeKey,
      });
      createdForUserIds.push(userId);
    } catch (error: any) {
      if (error?.code !== 11000) {
        console.error("[notifications] Error creando notificacion interna:", error);
      }
    }
  }

  return createdForUserIds;
};

const markSubscriptionDisabled = async (subscriptionId: unknown) => {
  if (!subscriptionId || !Types.ObjectId.isValid(String(subscriptionId))) return;

  await PushSubscriptionModel.findByIdAndUpdate(subscriptionId, {
    $set: {
      enabled: false,
    },
  });
};

const sendPushPayload = async (
  subscriptions: Array<{
    _id?: unknown;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>,
  payload: Record<string, unknown>
) => {
  if (!pushConfigured || !subscriptions.length) return;

  const body = JSON.stringify(payload);

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        body
      );
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await markSubscriptionDisabled(subscription?._id);
      } else {
        console.error("[notifications] Error enviando push:", error);
      }
    }
  }
};

const sendInternalPushToUsers = async (params: {
  userIds: string[];
  title: string;
  body: string;
  url: string;
  tag: string;
  data?: Record<string, unknown>;
}) => {
  if (!pushConfigured || !params.userIds.length) return;

  const objectIds = params.userIds
    .filter((userId) => Types.ObjectId.isValid(userId))
    .map((userId) => new Types.ObjectId(userId));

  if (!objectIds.length) return;

  const subscriptions = await PushSubscriptionModel.find({
    audience: "internal",
    userId: { $in: objectIds },
    enabled: true,
  })
    .select("_id endpoint keys")
    .lean();

  await sendPushPayload(subscriptions as any, {
    title: params.title,
    body: params.body,
    tag: params.tag,
    url: params.url,
    data: params.data,
    icon: getPushIconUrl(),
  });
};

const notifyUsers = async (params: NotifyUsersParams) => {
  const createdForUserIds = await createInAppNotifications({
    userIds: params.userIds,
    role: params.role,
    shippingId: params.shippingId,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data,
    dedupeKey: params.dedupeKey,
  });

  if (!createdForUserIds.length) return createdForUserIds;

  if (params.urlPath) {
    await sendInternalPushToUsers({
      userIds: createdForUserIds,
      title: params.title,
      body: params.body,
      url: buildHashUrl(params.urlPath),
      tag: params.pushTag || params.dedupeKey || params.type,
      data: params.data,
    });
  }

  return createdForUserIds;
};

const sendBuyerPush = async (params: {
  shippingId: string;
  title: string;
  body: string;
  tag: string;
  trackingCode: string;
  data?: Record<string, unknown>;
}) => {
  if (!pushConfigured || !Types.ObjectId.isValid(params.shippingId)) return;

  const subscriptions = await PushSubscriptionModel.find({
    audience: "buyer",
    shippingId: new Types.ObjectId(params.shippingId),
    enabled: true,
  })
    .select("_id endpoint keys")
    .lean();

  if (!subscriptions.length) return;

  await sendPushPayload(subscriptions as any, {
    title: params.title,
    body: params.body,
    tag: params.tag,
    url: buildHashUrl(`/tracking/${params.trackingCode}`),
    data: params.data,
    icon: getPushIconUrl(),
  });
};

const getInternalRecipientsForShipping = async (shipping: ShippingLike): Promise<string[]> => {
  const branchId = resolveBranchIdFromShipping(shipping);
  const query: Record<string, unknown> = {
    role: { $in: INTERNAL_RECIPIENT_ROLES as readonly InternalRecipientRole[] },
  };

  if (Types.ObjectId.isValid(branchId)) {
    query.$or = [
      { role: { $in: ["admin", "superadmin"] } },
      { sucursal: new Types.ObjectId(branchId) },
    ];
  }

  const users = await UserModel.find(query).select("_id").lean();
  return users.map((user: any) => String(user._id));
};

const buildReminderText = (shipping: ShippingLike) => {
  const clientName = toStringValue(shipping?.cliente) || "Cliente";
  const place = toStringValue(shipping?.lugar_entrega) || "destino";
  const deliveryTime = shipping?.hora_entrega_acordada
    ? new Date(shipping.hora_entrega_acordada as any)
    : null;
  const hhmm = deliveryTime && !Number.isNaN(deliveryTime.getTime())
    ? deliveryTime.toLocaleTimeString("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/La_Paz",
    })
    : "";

  return {
    title: "Entrega proxima",
    body: hhmm
      ? `Pedido de ${clientName} programado para las ${hhmm} en ${place}.`
      : `Pedido de ${clientName} programado pronto en ${place}.`,
  };
};

const buildBuyerTrackingCode = (shipping: ShippingLike): string => {
  const value = toStringValue(shipping?.buyer_tracking_code);
  if (value) return value;
  return toStringValue(shipping?.shipping_qr_code);
};

const ensureBuyerTrackingCode = async (shipping: any): Promise<string> => {
  const existing = buildBuyerTrackingCode(shipping);
  if (existing) return existing;

  const shippingId = toStringValue(shipping?._id);
  const randomChunk = Math.random().toString(36).slice(2, 8).toUpperCase();
  const generated = `TRK-${shippingId.slice(-6).toUpperCase()}-${randomChunk}`;

  if (Types.ObjectId.isValid(shippingId)) {
    await PedidoModel.findByIdAndUpdate(shippingId, {
      $set: {
        buyer_tracking_code: generated,
      },
    });
  }

  return generated;
};

const pushPayloadForBuyerCurrentState = async (shipping: ShippingLike) => {
  const shippingId = toStringValue(shipping?._id);
  const trackingCode = await ensureBuyerTrackingCode(shipping);
  const currentStatus = toStringValue(shipping?.estado_pedido);

  if (!shippingId || !trackingCode) return;

  if (currentStatus === BUYER_STATUSES.DELIVERED) {
    await sendBuyerPush({
      shippingId,
      trackingCode,
      title: "Pedido entregado",
      body: "Tu pedido ya fue marcado como entregado.",
      tag: `buyer-delivered-${shippingId}`,
      data: {
        shippingId,
        status: currentStatus,
      },
    });
    return;
  }

  if (currentStatus === BUYER_STATUSES.IN_TRANSIT) {
    await sendBuyerPush({
      shippingId,
      trackingCode,
      title: "Tu pedido esta en camino",
      body: "Tu pedido ya salio y esta en camino.",
      tag: `buyer-in-transit-${shippingId}`,
      data: {
        shippingId,
        status: currentStatus,
      },
    });
    return;
  }

  if (currentStatus === BUYER_STATUSES.CONFIRMED) {
    await sendBuyerPush({
      shippingId,
      trackingCode,
      title: "Pedido confirmado",
      body: "Tu pedido fue confirmado. Te avisaremos cuando salga.",
      tag: `buyer-confirmed-${shippingId}`,
      data: {
        shippingId,
        status: currentStatus,
      },
    });
  }
};

const handleShippingCreated = async (shipping: ShippingLike) => {
  try {
    const shippingId = toStringValue(shipping?._id);
    if (!shippingId) return;

    const trackingCode = await ensureBuyerTrackingCode(shipping);
    if (toStringValue(shipping?.estado_pedido) !== BUYER_STATUSES.CONFIRMED) return;

    await sendBuyerPush({
      shippingId,
      trackingCode,
      title: "Pedido confirmado",
      body: "Tu pedido fue confirmado. Te avisaremos cuando salga.",
      tag: `buyer-confirmed-${shippingId}`,
      data: {
        shippingId,
        status: BUYER_STATUSES.CONFIRMED,
      },
    });
  } catch (error) {
    console.error("[notifications] Error notificando pedido confirmado:", error);
  }
};

const handleShippingStatusChange = async (params: {
  before: ShippingLike;
  after: ShippingLike;
}) => {
  try {
    const fromStatus = toStringValue(params.before?.estado_pedido);
    const toStatus = toStringValue(params.after?.estado_pedido);
    const shippingId = toStringValue(params.after?._id || params.before?._id);

    if (!shippingId || !toStatus || fromStatus === toStatus) return;

    const trackingCode = await ensureBuyerTrackingCode(params.after);

    if (toStatus === BUYER_STATUSES.IN_TRANSIT) {
      await sendBuyerPush({
        shippingId,
        trackingCode,
        title: "Tu pedido esta en camino",
        body: "Tu pedido ya salio y esta en camino.",
        tag: `buyer-in-transit-${shippingId}`,
        data: {
          shippingId,
          fromStatus,
          toStatus,
        },
      });
      return;
    }

    if (toStatus === BUYER_STATUSES.DELIVERED) {
      await sendBuyerPush({
        shippingId,
        trackingCode,
        title: "Pedido entregado",
        body: "Tu pedido ya fue marcado como entregado.",
        tag: `buyer-delivered-${shippingId}`,
        data: {
          shippingId,
          fromStatus,
          toStatus,
        },
      });
    }
  } catch (error) {
    console.error("[notifications] Error notificando cambio de estado:", error);
  }
};

const getNotificationsForUser = async (userId: string, limit = 20) => {
  if (!Types.ObjectId.isValid(userId)) {
    return [];
  }

  return NotificationModel.find({
    userId: new Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 20)))
    .lean();
};

const getUnreadCountForUser = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) return 0;

  return NotificationModel.countDocuments({
    userId: new Types.ObjectId(userId),
    read: false,
  });
};

const markNotificationAsRead = async (notificationId: string, userId: string) => {
  if (!Types.ObjectId.isValid(notificationId) || !Types.ObjectId.isValid(userId)) {
    return null;
  }

  return NotificationModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    },
    { new: true }
  ).lean();
};

const markAllNotificationsAsRead = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) return { modifiedCount: 0 };

  const result = await NotificationModel.updateMany(
    {
      userId: new Types.ObjectId(userId),
      read: false,
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    }
  );

  return {
    modifiedCount: result.modifiedCount ?? 0,
  };
};

const registerInternalPushSubscription = async (params: {
  userId: string;
  role: string;
  subscription: unknown;
  userAgent?: string;
}) => {
  if (!Types.ObjectId.isValid(params.userId)) {
    throw new Error("Usuario invalido para push");
  }

  const normalizedRole = normalizeInternalRole(params.role);
  if (!normalizedRole) {
    throw new Error("Este usuario no puede suscribirse a push interno");
  }

  const subscription = normalizePushSubscription(params.subscription);

  await PushSubscriptionModel.deleteMany({
    audience: "internal",
    endpoint: subscription.endpoint,
  });

  await PushSubscriptionModel.findOneAndUpdate(
    {
      audience: "internal",
      userId: new Types.ObjectId(params.userId),
      endpoint: subscription.endpoint,
    },
    {
      $set: {
        audience: "internal",
        userId: new Types.ObjectId(params.userId),
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        role: normalizedRole,
        enabled: true,
        userAgent: toStringValue(params.userAgent),
        lastSeenAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    success: true,
    enabled: pushConfigured,
  };
};

const resolveTrackingShipping = async (trackingCode: string) => {
  const trimmed = toStringValue(trackingCode);
  if (!trimmed) return null;

  const byTrackingCode = await PedidoModel.findOne({
    buyer_tracking_code: trimmed,
  }).lean();
  if (byTrackingCode) return byTrackingCode;

  const byShippingCode = await PedidoModel.findOne({
    shipping_qr_code: trimmed,
  }).lean();
  if (byShippingCode) return byShippingCode;

  if (Types.ObjectId.isValid(trimmed)) {
    return PedidoModel.findById(trimmed).lean();
  }

  return null;
};

const getPublicTrackingByCode = async (trackingCode: string) => {
  const shipping = await resolveTrackingShipping(trackingCode);
  if (!shipping) {
    return null;
  }

  const resolvedTrackingCode = await ensureBuyerTrackingCode(shipping);

  return {
    shippingId: String(shipping._id),
    trackingCode: resolvedTrackingCode,
    cliente: toStringValue(shipping.cliente),
    estado_pedido: toStringValue(shipping.estado_pedido),
    lugar_entrega: toStringValue(shipping.lugar_entrega),
    hora_entrega_acordada: shipping.hora_entrega_acordada || null,
  };
};

const registerBuyerPushSubscription = async (params: {
  trackingCode: string;
  subscription: unknown;
  userAgent?: string;
}) => {
  const shipping = await resolveTrackingShipping(params.trackingCode);
  if (!shipping?._id) {
    throw new Error("Pedido no encontrado para tracking");
  }

  const subscription = normalizePushSubscription(params.subscription);
  const shippingId = String(shipping._id);

  await PushSubscriptionModel.findOneAndUpdate(
    {
      audience: "buyer",
      shippingId: new Types.ObjectId(shippingId),
      endpoint: subscription.endpoint,
    },
    {
      $set: {
        audience: "buyer",
        shippingId: new Types.ObjectId(shippingId),
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        enabled: true,
        userAgent: toStringValue(params.userAgent),
        lastSeenAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await pushPayloadForBuyerCurrentState(shipping);

  return {
    success: true,
    enabled: pushConfigured,
    trackingCode: await ensureBuyerTrackingCode(shipping),
  };
};

const runReminderSweep = async () => {
  try {
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

    const upcomingShippings = await PedidoModel.find({
      estado_pedido: BUYER_STATUSES.CONFIRMED,
      hora_entrega_acordada: {
        $gte: now,
        $lte: thirtyMinutesLater,
      },
    })
      .select("_id cliente hora_entrega_acordada lugar_entrega sucursal lugar_origen")
      .lean();

    for (const shipping of upcomingShippings) {
      const userIds = await getInternalRecipientsForShipping(shipping);
      if (!userIds.length) continue;

      const shippingId = String(shipping._id);
      const reminderText = buildReminderText(shipping);
      const createdForUserIds = await createInAppNotifications({
        userIds,
        role: "operator",
        shippingId,
        type: "delivery.reminder",
        title: reminderText.title,
        body: reminderText.body,
        data: {
          shippingId,
          status: BUYER_STATUSES.CONFIRMED,
          kind: "reminder_30m",
        },
        dedupeKey: `delivery.reminder.30m.${shippingId}`,
      });

      if (!createdForUserIds.length) continue;

      await sendInternalPushToUsers({
        userIds: createdForUserIds,
        title: reminderText.title,
        body: reminderText.body,
        url: buildHashUrl("/shipping"),
        tag: `delivery-reminder-${shippingId}`,
        data: {
          shippingId,
          screen: "shipping",
        },
      });
    }
  } catch (error) {
    console.error("[notifications] Error ejecutando reminders:", error);
  }
};

const startReminderScheduler = () => {
  if (reminderTimer) return;

  reminderTimer = setInterval(() => {
    void runReminderSweep();
  }, 60 * 1000);

  void runReminderSweep();
};

const getPushPublicConfig = () => ({
  enabled: pushConfigured,
  publicKey: PUSH_VAPID_PUBLIC_KEY || null,
});

export const NotificationService = {
  getPushPublicConfig,
  getNotificationsForUser,
  getUnreadCountForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  registerInternalPushSubscription,
  registerBuyerPushSubscription,
  getPublicTrackingByCode,
  handleShippingCreated,
  handleShippingStatusChange,
  startReminderScheduler,
  ensureBuyerTrackingCode,
  notifyUsers,
};
