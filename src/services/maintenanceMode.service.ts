import { Types } from "mongoose";
import { normalizeUserRole } from "../constants/roles";
import {
  IMaintenanceModeDocument,
  MaintenanceAllowedRole,
  MaintenanceModeModel,
} from "../entities/implements/MaintenanceModeSchema";

const GLOBAL_CONFIG_KEY = "global";
const DEFAULT_MESSAGE = "Estamos realizando tareas de mantenimiento. Vuelve a intentar en unos minutos.";
const DEFAULT_SUBTITLE = "Estamos haciendo ajustes para mejorar el sistema.";

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeAllowedRoles = (value: unknown): MaintenanceAllowedRole[] => {
  const source = Array.isArray(value) ? value : [];
  const next = Array.from(
    new Set(
      source
        .map((item) => normalizeUserRole(String(item || "")))
        .filter((role): role is MaintenanceAllowedRole => role === "admin" || role === "operator" || role === "seller")
    )
  );

  return next;
};

const normalizeAllowedUserIds = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => normalizeText(item))
        .filter((item) => Boolean(item) && Types.ObjectId.isValid(item))
    )
  );
};

const buildMaintenanceDto = (doc: Partial<IMaintenanceModeDocument> & { _id?: unknown }) => ({
  _id: String(doc?._id || ""),
  configKey: normalizeText(doc?.configKey) || GLOBAL_CONFIG_KEY,
  enabled: Boolean(doc?.enabled),
  message: normalizeText(doc?.message) || DEFAULT_MESSAGE,
  subtitle: normalizeText(doc?.subtitle) || DEFAULT_SUBTITLE,
  allowedRoles: Array.isArray(doc?.allowedRoles) ? doc.allowedRoles : [],
  targetUserScope: doc?.targetUserScope === "specific" ? "specific" : "all",
  targetUserIds: Array.isArray(doc?.targetUserIds)
    ? doc.targetUserIds.map((userId) => String(userId))
    : Array.isArray((doc as any)?.allowedUserIds)
      ? (doc as any).allowedUserIds.map((userId: any) => String(userId))
      : [],
  updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
  createdAt: doc?.createdAt || null,
  updatedAt: doc?.updatedAt || null,
});

const getMaintenanceConfig = async () => {
  const config = await MaintenanceModeModel.findOne({ configKey: GLOBAL_CONFIG_KEY }).lean();
  if (config) {
    return buildMaintenanceDto(config);
  }

  const created = await MaintenanceModeModel.create({
    configKey: GLOBAL_CONFIG_KEY,
    enabled: false,
    message: DEFAULT_MESSAGE,
    subtitle: DEFAULT_SUBTITLE,
    allowedRoles: [],
    targetUserScope: "all",
    targetUserIds: [],
  });

  return buildMaintenanceDto(created.toObject());
};

const updateMaintenanceConfig = async (params: {
  actorUserId: string;
  enabled: unknown;
  message: unknown;
  subtitle?: unknown;
  allowedRoles?: unknown;
  targetUserScope?: unknown;
  targetUserIds?: unknown;
}) => {
  const actorUserId = normalizeText(params.actorUserId);
  if (!Types.ObjectId.isValid(actorUserId)) {
    throw new Error("Usuario invalido");
  }

  const message = normalizeText(params.message);
  if (!message) {
    throw new Error("El mensaje de mantenimiento es obligatorio");
  }

  const enabled = Boolean(params.enabled);
  const allowedRoles = normalizeAllowedRoles(params.allowedRoles);
  const targetUserScope = String(params.targetUserScope || "all").trim() === "specific" ? "specific" : "all";
  const targetUserIds = normalizeAllowedUserIds(params.targetUserIds);

  if (targetUserScope === "specific" && targetUserIds.length === 0) {
    throw new Error("Selecciona al menos un usuario cuando el alcance es especifico");
  }

  const updated = await MaintenanceModeModel.findOneAndUpdate(
    { configKey: GLOBAL_CONFIG_KEY },
    {
      $set: {
        enabled,
        message,
        subtitle: normalizeText(params.subtitle) || DEFAULT_SUBTITLE,
        allowedRoles,
        targetUserScope,
        targetUserIds: targetUserIds.map((userId) => new Types.ObjectId(userId)),
        updatedBy: new Types.ObjectId(actorUserId),
      },
      $setOnInsert: {
        configKey: GLOBAL_CONFIG_KEY,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return buildMaintenanceDto(updated?.toObject() || updated || {});
};

const evaluateMaintenanceForUser = async (params: { userId?: string; role?: string }) => {
  const config = await getMaintenanceConfig();
  const normalizedRole = normalizeUserRole(params.role);
  const normalizedUserId = normalizeText(params.userId);

  const isSuperadmin = normalizedRole === "superadmin";
  const isAllowedByRole = Boolean(normalizedRole) && config.allowedRoles.includes(normalizedRole as MaintenanceAllowedRole);
  const targetUserIds = Array.isArray((config as any).targetUserIds)
    ? (config as any).targetUserIds
    : Array.isArray((config as any).allowedUserIds)
      ? (config as any).allowedUserIds
      : [];
  const isTargetedByUser =
    config.targetUserScope === "all" ||
    (Boolean(normalizedUserId) && targetUserIds.includes(normalizedUserId));
  const blocked = Boolean(config.enabled) && !isSuperadmin && !isAllowedByRole && isTargetedByUser;

  return {
    ...config,
    blocked,
    bypassReason: isSuperadmin ? "superadmin" : isAllowedByRole ? "role" : isTargetedByUser ? "user" : null,
  };
};

export const MaintenanceModeService = {
  getMaintenanceConfig,
  updateMaintenanceConfig,
  evaluateMaintenanceForUser,
};
