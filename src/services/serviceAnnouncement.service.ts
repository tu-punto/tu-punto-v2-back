import { extname } from "path";
import { Types } from "mongoose";
import {
  IServiceAnnouncementAttachment,
  IServiceAnnouncementDocument,
  ServiceAnnouncementModel,
  ServiceAnnouncementRole,
} from "../entities/implements/ServiceAnnouncementSchema";
import { ServiceAnnouncementReceiptModel } from "../entities/implements/ServiceAnnouncementReceiptSchema";
import { UserModel } from "../entities/implements/UserSchema";
import { getPublicUserRole } from "../constants/roles";
import { NotificationService } from "./notification.service";
import { awsFolderNames } from "../config/bucketConfig";
import { deleteFileFromAws, uploadFileToAws } from "./bucket.service";

const TARGET_ROLES: readonly ServiceAnnouncementRole[] = ["admin", "operator", "seller"];
const MAX_LINK_ATTACHMENTS = 6;
const MAX_FILE_ATTACHMENTS = 6;

type UploadedAnnouncementFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const toStringValue = (value: unknown): string => String(value ?? "").trim();
const toOptionalStringValue = (value: unknown): string | undefined => {
  const normalized = toStringValue(value);
  return normalized || undefined;
};

const normalizeViewerRole = (role: unknown): ServiceAnnouncementRole | "" => {
  const normalized = getPublicUserRole(toStringValue(role));
  if ((TARGET_ROLES as readonly string[]).includes(normalized)) {
    return normalized as ServiceAnnouncementRole;
  }
  return "";
};

const normalizeTargetRoles = (value: unknown): ServiceAnnouncementRole[] => {
  const source = Array.isArray(value) ? value : [];
  const next = Array.from(
    new Set(
      source
        .map((role) => normalizeViewerRole(role))
        .filter(Boolean)
    )
  ) as ServiceAnnouncementRole[];
  return next.length ? next : ["seller"];
};

const normalizeAttachmentUrl = (value: unknown) => {
  const raw = toStringValue(value);
  if (!raw) {
    throw new Error("Cada link adjunto debe tener una URL");
  }

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Solo se permiten links http o https");
    }
    return parsed.toString();
  } catch (_error) {
    throw new Error(`URL invalida en adjuntos: ${raw}`);
  }
};

const sanitizePathSegment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const getAttachmentExtension = (fileName: string) => {
  const rawExtension = extname(fileName || "").replace(".", "").trim().toLowerCase();
  return rawExtension || undefined;
};

const buildAttachmentS3Key = (fileName: string) => {
  const safeName = sanitizePathSegment(fileName || "archivo");
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${awsFolderNames.serviceAnnouncements}/attachments/${uniqueSuffix}-${safeName || "archivo"}`;
};

const normalizeLinkAttachments = (value: unknown): IServiceAnnouncementAttachment[] => {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) {
    throw new Error("Los links adjuntos deben enviarse en un arreglo");
  }
  if (value.length > MAX_LINK_ATTACHMENTS) {
    throw new Error(`Solo se permiten hasta ${MAX_LINK_ATTACHMENTS} links adjuntos`);
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        throw new Error("Cada link adjunto debe tener formato valido");
      }

      return {
        kind: "link" as const,
        title: toOptionalStringValue((item as any).title),
        url: normalizeAttachmentUrl((item as any).url),
      };
    })
    .filter((item) => Boolean(item.url));
};

const uploadAnnouncementFiles = async (
  files: UploadedAnnouncementFile[] = []
): Promise<IServiceAnnouncementAttachment[]> => {
  if (!files.length) return [];
  if (files.length > MAX_FILE_ATTACHMENTS) {
    throw new Error(`Solo se permiten hasta ${MAX_FILE_ATTACHMENTS} archivos adjuntos`);
  }

  return Promise.all(
    files.map(async (file) => {
      const fileName = toStringValue(file.originalname) || "archivo";
      const key = buildAttachmentS3Key(fileName);
      const url = await uploadFileToAws(file.buffer, key, file.mimetype || "application/octet-stream");
      return {
        kind: "file" as const,
        title: fileName,
        url,
        fileName,
        contentType: toOptionalStringValue(file.mimetype),
        size: Number(file.size || 0),
        extension: getAttachmentExtension(fileName),
        s3Key: key,
      };
    })
  );
};

const ensureObjectId = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} invalido`);
  }
};

const buildAnnouncementDto = (
  announcement: Partial<IServiceAnnouncementDocument> & { _id?: unknown },
  receipt?: { acknowledgedAt?: Date | null; acceptedAt?: Date | null } | null
) => ({
  _id: String(announcement?._id || ""),
  title: toStringValue(announcement?.title),
  version: toStringValue(announcement?.version),
  summary: toStringValue(announcement?.summary),
  body: toStringValue(announcement?.body),
  regulation: toStringValue(announcement?.regulation),
  policyText: toStringValue(announcement?.policyText),
  attachments: Array.isArray(announcement?.attachments)
    ? announcement.attachments.map((attachment) => ({
        kind: attachment.kind === "file" ? "file" : "link",
        title: toStringValue(attachment.title),
        url: toStringValue(attachment.url),
        fileName: toStringValue(attachment.fileName),
        contentType: toStringValue(attachment.contentType),
        size: Number(attachment.size || 0),
        extension: toStringValue(attachment.extension),
        s3Key: toStringValue(attachment.s3Key),
      }))
    : [],
  targetRoles: Array.isArray(announcement?.targetRoles) ? announcement.targetRoles : [],
  requireAcceptance: Boolean(announcement?.requireAcceptance),
  sendPush: Boolean(announcement?.sendPush),
  status: toStringValue(announcement?.status) || "draft",
  publishedAt: announcement?.publishedAt || null,
  createdAt: announcement?.createdAt || null,
  updatedAt: announcement?.updatedAt || null,
  isAcknowledged: Boolean(receipt?.acknowledgedAt),
  isAccepted: Boolean(receipt?.acceptedAt),
  pendingRead: !receipt?.acknowledgedAt,
  pendingAcceptance: Boolean(announcement?.requireAcceptance) && !receipt?.acceptedAt,
});

const getTargetUserIds = async (targetRoles: ServiceAnnouncementRole[]) => {
  const queryRoles = targetRoles.includes("admin")
    ? [...targetRoles, "superadmin"]
    : targetRoles;
  const users = await UserModel.find({
    role: { $in: queryRoles },
  })
    .select("_id role")
    .lean();

  return users.map((user: any) => String(user._id));
};

const notifyPublishedAnnouncement = async (announcement: IServiceAnnouncementDocument) => {
  const userIds = await getTargetUserIds(announcement.targetRoles || []);
  if (!userIds.length) return;

  const title = `Servicio: ${toStringValue(announcement.title)}`;
  const summary = toStringValue(announcement.summary) || toStringValue(announcement.body);
  const body = summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
  const announcementId = String(announcement._id);

  await NotificationService.notifyUsers({
    userIds,
    type: "service.announcement",
    title,
    body,
    data: {
      announcementId,
      screen: "services",
      urlPath: "/servicesPage",
      requireAcceptance: Boolean(announcement.requireAcceptance),
      version: toStringValue(announcement.version),
    },
    dedupeKey: `service.announcement.${announcementId}`,
    urlPath: announcement.sendPush ? "/servicesPage" : undefined,
    pushTag: `service-announcement-${announcementId}`,
  });
};

const listAdminAnnouncements = async () => {
  const announcements = await ServiceAnnouncementModel.find({})
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();

  return announcements.map((item) => buildAnnouncementDto(item));
};

const listAnnouncementsForUser = async (userId: string, role: string) => {
  ensureObjectId(userId, "Usuario");
  const viewerRole = normalizeViewerRole(role);
  if (!viewerRole) {
    return [];
  }

  const announcements = await ServiceAnnouncementModel.find({
    status: "published",
    targetRoles: viewerRole,
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();

  if (!announcements.length) return [];

  const announcementIds = announcements.map((item) => item._id);
  const receipts = await ServiceAnnouncementReceiptModel.find({
    userId: new Types.ObjectId(userId),
    announcementId: { $in: announcementIds },
  }).lean();

  const receiptMap = new Map(
    receipts.map((receipt) => [String(receipt.announcementId), receipt])
  );

  return announcements.map((item) =>
    buildAnnouncementDto(item, receiptMap.get(String(item._id)))
  );
};

const getPendingAnnouncementForUser = async (userId: string, role: string) => {
  const announcements = await listAnnouncementsForUser(userId, role);
  return announcements.find((item) => item.pendingAcceptance) || null;
};

const createAnnouncement = async (params: {
  actorUserId: string;
  title: string;
  version: string;
  summary?: string;
  body: string;
  regulation?: string;
  policyText?: string;
  linkAttachments?: unknown;
  attachmentFiles?: UploadedAnnouncementFile[];
  targetRoles?: unknown;
  requireAcceptance?: boolean;
  sendPush?: boolean;
  publishNow?: boolean;
}) => {
  ensureObjectId(params.actorUserId, "Usuario");

  const title = toStringValue(params.title);
  const version = toStringValue(params.version);
  const body = toStringValue(params.body);

  if (!title) throw new Error("Titulo requerido");
  if (!version) throw new Error("Version requerida");
  if (!body) throw new Error("Mensaje requerido");

  const linkAttachments = normalizeLinkAttachments(params.linkAttachments);
  let uploadedFileAttachments: IServiceAnnouncementAttachment[] = [];

  try {
    uploadedFileAttachments = await uploadAnnouncementFiles(params.attachmentFiles);
    const announcement = await ServiceAnnouncementModel.create({
      title,
      version,
      summary: toStringValue(params.summary),
      body,
      regulation: toStringValue(params.regulation),
      policyText: toStringValue(params.policyText),
      attachments: [...linkAttachments, ...uploadedFileAttachments],
      targetRoles: normalizeTargetRoles(params.targetRoles),
      requireAcceptance: Boolean(params.requireAcceptance),
      sendPush: params.sendPush !== false,
      status: params.publishNow ? "published" : "draft",
      publishedAt: params.publishNow ? new Date() : undefined,
      createdBy: new Types.ObjectId(params.actorUserId),
    });

    if (params.publishNow) {
      notifyPublishedAnnouncement(announcement).catch((error) => {
        console.error("[service-announcements] No se pudo notificar el comunicado publicado:", error);
      });
    }

    return buildAnnouncementDto(announcement.toObject());
  } catch (error) {
    if (uploadedFileAttachments.length > 0) {
      await Promise.allSettled(
        uploadedFileAttachments
          .map((attachment) => toStringValue(attachment.s3Key))
          .filter(Boolean)
          .map((key) => deleteFileFromAws(key))
      );
    }
    throw error;
  }
};

const publishAnnouncement = async (announcementId: string) => {
  ensureObjectId(announcementId, "Comunicado");

  const announcement = await ServiceAnnouncementModel.findByIdAndUpdate(
    announcementId,
    {
      $set: {
        status: "published",
        publishedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!announcement) {
    throw new Error("Comunicado no encontrado");
  }

  await notifyPublishedAnnouncement(announcement);
  return buildAnnouncementDto(announcement.toObject());
};

const acknowledgeAnnouncement = async (params: {
  announcementId: string;
  userId: string;
  role: string;
}) => {
  ensureObjectId(params.announcementId, "Comunicado");
  ensureObjectId(params.userId, "Usuario");

  const viewerRole = normalizeViewerRole(params.role);
  if (!viewerRole) throw new Error("Rol no valido para este comunicado");

  const announcement = await ServiceAnnouncementModel.findOne({
    _id: new Types.ObjectId(params.announcementId),
    status: "published",
    targetRoles: viewerRole,
  }).lean();

  if (!announcement) {
    throw new Error("Comunicado no encontrado");
  }

  const now = new Date();
  await ServiceAnnouncementReceiptModel.findOneAndUpdate(
    {
      announcementId: new Types.ObjectId(params.announcementId),
      userId: new Types.ObjectId(params.userId),
    },
    {
      $set: {
        acknowledgedAt: now,
      },
      $setOnInsert: {
        acceptedAt: announcement.requireAcceptance ? undefined : now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return { success: true };
};

const acceptAnnouncement = async (params: {
  announcementId: string;
  userId: string;
  role: string;
}) => {
  ensureObjectId(params.announcementId, "Comunicado");
  ensureObjectId(params.userId, "Usuario");

  const viewerRole = normalizeViewerRole(params.role);
  if (!viewerRole) throw new Error("Rol no valido para este comunicado");

  const announcement = await ServiceAnnouncementModel.findOne({
    _id: new Types.ObjectId(params.announcementId),
    status: "published",
    targetRoles: viewerRole,
  }).lean();

  if (!announcement) {
    throw new Error("Comunicado no encontrado");
  }

  const now = new Date();
  await ServiceAnnouncementReceiptModel.findOneAndUpdate(
    {
      announcementId: new Types.ObjectId(params.announcementId),
      userId: new Types.ObjectId(params.userId),
    },
    {
      $set: {
        acknowledgedAt: now,
        acceptedAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return { success: true };
};

export const ServiceAnnouncementService = {
  listAdminAnnouncements,
  listAnnouncementsForUser,
  getPendingAnnouncementForUser,
  createAnnouncement,
  publishAnnouncement,
  acknowledgeAnnouncement,
  acceptAnnouncement,
};
