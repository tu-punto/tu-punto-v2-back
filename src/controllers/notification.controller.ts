import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";

const getAuthContext = (res: Response) =>
  (res.locals.auth as { id?: string; role?: string } | undefined) || {};

export const getPushPublicConfigController = async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      ...NotificationService.getPushPublicConfig(),
    });
  } catch (error) {
    console.error("[notifications] Error obteniendo config push:", error);
    res.status(500).json({
      success: false,
      message: "No se pudo obtener la configuracion de push",
    });
  }
};

export const listNotificationsController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const limit = Number(req.query.limit || 20);
    const notifications = await NotificationService.getNotificationsForUser(String(auth.id || ""), limit);
    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("[notifications] Error listando notificaciones:", error);
    res.status(500).json({
      success: false,
      message: "No se pudieron obtener las notificaciones",
    });
  }
};

export const getUnreadNotificationsCountController = async (_req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const unreadCount = await NotificationService.getUnreadCountForUser(String(auth.id || ""));
    res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("[notifications] Error obteniendo contador:", error);
    res.status(500).json({
      success: false,
      message: "No se pudo obtener el contador de notificaciones",
    });
  }
};

export const markNotificationAsReadController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const notification = await NotificationService.markNotificationAsRead(
      req.params.id,
      String(auth.id || "")
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notificacion no encontrada",
      });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[notifications] Error marcando notificacion:", error);
    res.status(500).json({
      success: false,
      message: "No se pudo actualizar la notificacion",
    });
  }
};

export const markAllNotificationsAsReadController = async (_req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const result = await NotificationService.markAllNotificationsAsRead(String(auth.id || ""));
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[notifications] Error marcando todas:", error);
    res.status(500).json({
      success: false,
      message: "No se pudieron marcar las notificaciones",
    });
  }
};

export const registerInternalPushSubscriptionController = async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(res);
    const result = await NotificationService.registerInternalPushSubscription({
      userId: String(auth.id || ""),
      role: String(auth.role || ""),
      subscription: req.body?.subscription,
      userAgent: req.headers["user-agent"],
    });

    res.json(result);
  } catch (error: any) {
    console.error("[notifications] Error registrando push interno:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo registrar la suscripcion push",
    });
  }
};

export const getPublicTrackingController = async (req: Request, res: Response) => {
  try {
    const tracking = await NotificationService.getPublicTrackingByCode(req.params.code);
    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
    }

    res.json({
      success: true,
      tracking,
    });
  } catch (error) {
    console.error("[notifications] Error obteniendo tracking publico:", error);
    res.status(500).json({
      success: false,
      message: "No se pudo obtener el tracking",
    });
  }
};

export const registerBuyerPushSubscriptionController = async (req: Request, res: Response) => {
  try {
    const result = await NotificationService.registerBuyerPushSubscription({
      trackingCode: req.params.code,
      subscription: req.body?.subscription,
      userAgent: req.headers["user-agent"],
    });

    res.json(result);
  } catch (error: any) {
    console.error("[notifications] Error registrando push comprador:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo registrar la suscripcion del comprador",
    });
  }
};
