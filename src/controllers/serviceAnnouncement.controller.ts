import { Request, Response } from "express";
import { ServiceAnnouncementService } from "../services/serviceAnnouncement.service";

const getAuthContext = (res: Response) =>
  (res.locals.auth as { id?: string; role?: string } | undefined) || {};

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed);
};

const parseOptionalBooleanValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "yes", "si"].includes(normalized)) return true;
    if (["false", "0", "off", "no"].includes(normalized)) return false;
  }
  return Boolean(value);
};

export const listMyServiceAnnouncementsController = async (_req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const announcements = await ServiceAnnouncementService.listAnnouncementsForUser(
      String(auth.id || ""),
      String(auth.role || "")
    );

    res.json({
      success: true,
      announcements,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error listando comunicados:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudieron obtener los comunicados",
    });
  }
};

export const getPendingServiceAnnouncementController = async (_req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const announcement = await ServiceAnnouncementService.getPendingAnnouncementForUser(
      String(auth.id || ""),
      String(auth.role || "")
    );

    res.json({
      success: true,
      announcement,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error obteniendo pendiente:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo obtener el comunicado pendiente",
    });
  }
};

export const listAdminServiceAnnouncementsController = async (_req: Request, res: Response) => {
  try {
    const announcements = await ServiceAnnouncementService.listAdminAnnouncements();
    res.json({
      success: true,
      announcements,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error listando admin:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "No se pudieron obtener los comunicados",
    });
  }
};

export const createServiceAnnouncementController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    const announcement = await ServiceAnnouncementService.createAnnouncement({
      actorUserId: String(auth.id || ""),
      title: req.body?.title,
      version: req.body?.version,
      summary: req.body?.summary,
      body: req.body?.body,
      regulation: req.body?.regulation,
      policyText: req.body?.policyText,
      linkAttachments: parseMaybeJson(req.body?.linkAttachments),
      attachmentFiles: files.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
      targetRoles: parseMaybeJson(req.body?.targetRoles),
      requireAcceptance: parseOptionalBooleanValue(req.body?.requireAcceptance),
      sendPush: parseOptionalBooleanValue(req.body?.sendPush),
      publishNow: parseOptionalBooleanValue(req.body?.publishNow),
    });

    res.json({
      success: true,
      announcement,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error creando comunicado:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo crear el comunicado",
    });
  }
};

export const publishServiceAnnouncementController = async (req: Request, res: Response) => {
  try {
    const announcement = await ServiceAnnouncementService.publishAnnouncement(req.params.id);
    res.json({
      success: true,
      announcement,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error publicando comunicado:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo publicar el comunicado",
    });
  }
};

export const acknowledgeServiceAnnouncementController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const result = await ServiceAnnouncementService.acknowledgeAnnouncement({
      announcementId: req.params.id,
      userId: String(auth.id || ""),
      role: String(auth.role || ""),
    });

    res.json({
      success: true,
      acknowledged: result.success,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error marcando leido:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo marcar el comunicado",
    });
  }
};

export const acceptServiceAnnouncementController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const result = await ServiceAnnouncementService.acceptAnnouncement({
      announcementId: req.params.id,
      userId: String(auth.id || ""),
      role: String(auth.role || ""),
    });

    res.json({
      success: true,
      accepted: result.success,
    });
  } catch (error: any) {
    console.error("[service-announcements] Error aceptando comunicado:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo aceptar el comunicado",
    });
  }
};
