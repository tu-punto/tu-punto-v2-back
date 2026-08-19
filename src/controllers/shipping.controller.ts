import { Request, Response } from "express";
import { ShippingService } from "../services/shipping.service";
import { CatalogOrderIntegrationService } from "../services/catalogOrderIntegration.service";
import { ActionTraceService } from "../services/actionTrace.service";
import { getActionTraceActorFromResponse } from "../helpers/actionTrace";

const traceAction = (
  res: Response,
  payload: {
    actionType: string;
    sourceModule: string;
    sourceId?: string;
    entityType?: string;
    entityId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
  status: "success" | "failed" = "success",
  error?: unknown
) => {
  if (status === "failed") {
    void ActionTraceService.recordFailureFromError({
      ...payload,
      actor: getActionTraceActorFromResponse(res),
      error,
    });
    return;
  }

  void ActionTraceService.recordActionTraceSafe({
    ...payload,
    actor: getActionTraceActorFromResponse(res),
    status: "success",
  });
};

export const getShipping = async (req: Request, res: Response) => {
  try {
    const shippings = await ShippingService.getAllShippings();
    res.json(shippings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getShippingList = async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { role?: string; sucursalId?: string } | undefined;
    const authRole = String(auth?.role || "").toLowerCase();
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const status = (req.query.status as string | undefined) || undefined;
    const originId = (req.query.originId as string | undefined) || undefined;
    const sellerId = (req.query.sellerId as string | undefined) || undefined;
    const client = (req.query.client as string | undefined) || undefined;
    const guide = (req.query.guide as string | undefined) || undefined;
    const fromRaw = (req.query.from as string | undefined) || undefined;
    const toRaw = (req.query.to as string | undefined) || undefined;

    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;

    const result = await ShippingService.getShippingsList({
      page,
      limit,
      status,
      from,
      to,
      originId,
      branchContextId:
        authRole === "admin" || authRole === "operator"
          ? auth?.sucursalId
          : undefined,
      sellerId,
      client,
      guide
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getShippingDashboardList = async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { role?: string; sucursalId?: string; sellerId?: string } | undefined;
    const authRole = String(auth?.role || "").toLowerCase();
    const isSellerRole = authRole === "seller";
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);
    const tab = (req.query.tab as string | undefined) || "todos";
    const requestedSellerId = (req.query.sellerId as string | undefined) || undefined;
    const sellerId = isSellerRole
      ? String(auth?.sellerId || requestedSellerId || "").trim() || undefined
      : requestedSellerId;
    const client = (req.query.client as string | undefined) || undefined;
    const externalSellerSearch = (req.query.externalSellerSearch as string | undefined) || undefined;
    const guide = (req.query.guide as string | undefined) || undefined;
    const destinationMode = (req.query.destinationMode as "any" | "branch" | "other" | undefined) || "any";
    const destinationQuery = (req.query.destinationQuery as string | undefined) || undefined;
    const fromRaw = (req.query.from as string | undefined) || undefined;
    const toRaw = (req.query.to as string | undefined) || undefined;
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    const currentBranchId =
      authRole === "admin" || authRole === "operator" || authRole === "superadmin"
        ? String(req.query.currentBranchId || auth?.sucursalId || "").trim()
        : String(auth?.sucursalId || "").trim();
    const category = (req.query.category as "all" | "externos" | "paquetes" | undefined) || "all";
    const ignoreBranchVisibility = isSellerRole;

    if (isSellerRole || sellerId) {
      console.log("[shipping-dashboard][controller][context]", {
        authRole,
        authSellerId: auth?.sellerId || "",
        authSucursalId: auth?.sucursalId || "",
        currentBranchId,
        requestedSellerId: requestedSellerId || "",
        sellerId,
        tab,
        category,
        externalSellerSearch: externalSellerSearch || "",
        destinationMode,
        destinationQuery: destinationQuery || "",
        client: client || "",
        guide: guide || "",
        page,
        limit,
        ignoreBranchVisibility,
      });
    }

    const result = await ShippingService.getShippingDashboardList({
      page,
      limit,
      tab: tab as any,
      category,
      from,
      to,
      currentBranchId,
      ignoreBranchVisibility,
      sellerId,
      client,
      externalSellerSearch,
      guide,
      destinationMode,
      destinationQuery,
    });

    if (isSellerRole || sellerId) {
      console.log("[shipping-dashboard][controller][context][result]", {
        authRole,
        sellerId: sellerId || "",
        ignoreBranchVisibility,
        rows: Array.isArray(result?.rows) ? result.rows.length : 0,
        total: result?.total || 0,
        counts: result?.counts || {},
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getShippingByIds = async (req: Request, res: Response) => {
  const { ids } = req.params;
  try {
    const idsArray = ids.split(",").map((id) => (id.trim()));
    const shippings = await ShippingService.getShippingByIds(idsArray);
    res.json(shippings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting shippings by Ids" });
  }
};
export const registerShipping = async (req: Request, res: Response) => {
  const shipping = req.body;
  try {
    const newShipping = await ShippingService.registerShipping(shipping);
    traceAction(res, {
      actionType: "shipping.create",
      sourceModule: "shipping.controller",
      sourceId: String(newShipping?._id || newShipping?.id || ""),
      entityType: "shipping",
      entityId: String(newShipping?._id || newShipping?.id || ""),
      summary: `Se registró una entrega ${String(newShipping?._id || "")}`,
    });
    res.json({
      status: true,
      newShipping,
    });
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "shipping.create",
      sourceModule: "shipping.controller",
      entityType: "shipping",
      summary: "Falló el registro de entrega",
    }, "failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerSaleToShipping = async (req: Request, res: Response) => {
  const { shippingId, sales } = req.body;

  try {
    const auth = res.locals.auth as { id?: string; role?: string; email?: string; sellerId?: string } | undefined;
    const result = await ShippingService.processSalesForShipping(shippingId, sales, {
      auditActor: {
        userId: String(auth?.id || "").trim() || undefined,
        role: String(auth?.role || "").trim() || undefined,
        name: String(auth?.email || "").trim() || undefined,
        sellerId: String(auth?.sellerId || "").trim() || undefined,
      },
    });
    traceAction(res, {
      actionType: "shipping.attach_sales",
      sourceModule: "shipping.controller",
      sourceId: String(shippingId || ""),
      entityType: "shipping",
      entityId: String(shippingId || ""),
      summary: `Se adjuntaron ventas al pedido ${String(shippingId || "")}`,
      metadata: { count: Array.isArray(sales) ? sales.length : 0 },
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "shipping.attach_sales",
      sourceModule: "shipping.controller",
      sourceId: String(shippingId || ""),
      entityType: "shipping",
      entityId: String(shippingId || ""),
      summary: `Falló la asociación de ventas al pedido ${String(shippingId || "")}`,
    }, "failed", error);
    res.status(500).json({ msg: "Shipping Internal Server Error", error });
  }
};

export const getShippingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const shipping = await ShippingService.getShippingById(id);
    if (!shipping) return res.status(404).json({ success: false, msg: "Pedido no encontrado" });
    res.json(shipping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: "Error interno" });
  }
};


const updateShipping = async (req: Request, res: Response) => {
  const id = req.params.id;
  const newData = req.body;

  try {
    const auth = res.locals.auth as { id?: string; role?: string; sucursalId?: string } | undefined;
    const role = String(auth?.role || "").toLowerCase();
    const currentBranchIdFromBody =
      role === "admin" || role === "operator" || role === "superadmin"
        ? String(req.body?.currentBranchId || req.body?.sucursalId || "").trim()
        : "";
    delete newData.currentBranchId;
    const shippingUpdated = await ShippingService.updateShipping(newData, id, {
      currentBranchId: currentBranchIdFromBody || auth?.sucursalId,
      source: "manual",
      changedBy: auth?.id ? `${String(auth.role || "user")}:${String(auth.id)}` : undefined,
      actorRole: role,
    });
    traceAction(res, {
      actionType: "shipping.update",
      sourceModule: "shipping.controller",
      sourceId: String(id || ""),
      entityType: "shipping",
      entityId: String(id || ""),
      summary: `Se actualizó la entrega ${String(id || "")}`,
      metadata: { fields: Object.keys(newData || {}) },
    });
    res.json({ success: true, shippingUpdated });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    traceAction(res, {
      actionType: "shipping.update",
      sourceModule: "shipping.controller",
      sourceId: String(id || ""),
      entityType: "shipping",
      entityId: String(id || ""),
      summary: `Falló la actualización de la entrega ${String(id || "")}`,
    }, "failed", error);
    res.status(400).json({ success: false, msg: message, message, error });
  }
};
export const addTemporaryProductsToShipping = async (req: Request, res: Response) => {
  const id = req.params.id;
  const { productos_temporales } = req.body;

  if (!Array.isArray(productos_temporales)) {
    return res.status(400).json({
      success: false,
      msg: "productos_temporales debe ser un array válido",
    });
  }

  try {
    await ShippingService.addTemporaryProductsToShipping(id, productos_temporales);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: "Internal Server Error", error });
  }
};

export const getShippingsBySellerController = async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;
  try {
    const shippingsBySeller = await ShippingService.getShippingsBySellerService(
      id
    );
    res.json(shippingsBySeller);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
export const deleteShippingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const auth = res.locals.auth as { id?: string; role?: string; email?: string; sellerId?: string } | undefined;
    await ShippingService.deleteShippingById(id, {
      userId: String(auth?.id || "").trim() || undefined,
      role: String(auth?.role || "").trim() || undefined,
      name: String(auth?.email || "").trim() || undefined,
      sellerId: String(auth?.sellerId || "").trim() || undefined,
    });
    traceAction(res, {
      actionType: "shipping.delete",
      sourceModule: "shipping.controller",
      sourceId: String(id || ""),
      entityType: "shipping",
      entityId: String(id || ""),
      summary: `Se eliminó la entrega ${String(id || "")}`,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al eliminar el pedido:", error);
    traceAction(res, {
      actionType: "shipping.delete",
      sourceModule: "shipping.controller",
      sourceId: String(id || ""),
      entityType: "shipping",
      entityId: String(id || ""),
      summary: `Falló la eliminación de la entrega ${String(id || "")}`,
    }, "failed", error);
    res.status(500).json({ success: false, msg: "No se pudo eliminar el pedido" });
  }
};

export const getSalesHistory = async (req: Request, res: Response) => {
  const { date, sucursalId, fromLastClose, to } = req.query;
  const useLastClose = String(fromLastClose || "").toLowerCase() === "true";
  try {
    const result = await ShippingService.getDailySalesHistory(
      date as string | undefined,
      sucursalId as string,
      useLastClose,
      to as string | undefined
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener historial de ventas:", error);
    res.status(500).json({ success: false, msg: "Error interno" });
  }
};
export const generateQRForShipping = async (req: Request, res: Response) => {
  const { id } = req.params;
  const forceRegenerate = req.query.forceRegenerate === "true";

  try {
    const qrData = await ShippingService.generateShippingQR(id, forceRegenerate);
    traceAction(res, {
      actionType: "shipping.qr_generate",
      sourceModule: "shipping.controller",
      sourceId: String(id || ""),
      entityType: "shipping",
      entityId: String(id || ""),
      summary: `Se generó el QR de la entrega ${String(id || "")}`,
      metadata: { forceRegenerate },
    });
    res.json({
      success: true,
      qrData
    });
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "shipping.qr_generate",
      sourceModule: "shipping.controller",
      sourceId: String(id || ""),
      entityType: "shipping",
      entityId: String(id || ""),
      summary: `Falló la generación del QR de la entrega ${String(id || "")}`,
      metadata: { forceRegenerate },
    }, "failed", error);
    res.status(500).json({ error: "Error al generar el QR" });
  }
};

export const getShippingByQR = async (req: Request, res: Response) => {
  const { id: codeOrId } = req.params;

  try {
    const shipping = await ShippingService.getShippingDetailsForQR(codeOrId);
    if (!shipping) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(shipping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener información del pedido" });
  }
};

export const resolveShippingByQRPayload = async (req: Request, res: Response) => {
  const payload = req.query.payload as string | undefined;

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: "payload es requerido"
    });
  }

  try {
    const shipping = await ShippingService.resolveShippingByQRPayload(payload);
    if (!shipping) {
      traceAction(res, {
        actionType: "shipping.qr_resolve",
        sourceModule: "shipping.controller",
        summary: "No se encontró pedido para un QR",
      }, "failed", new Error("shipping not found"));
      return res.status(404).json({
        success: false,
        message: "No se encontró pedido para ese QR"
      });
    }

    traceAction(res, {
      actionType: "shipping.qr_resolve",
      sourceModule: "shipping.controller",
      sourceId: String((shipping as any)?._id || (shipping as any)?.id || payload || ""),
      entityType: "shipping",
      entityId: String((shipping as any)?._id || (shipping as any)?.id || ""),
      summary: "Se resolvió un QR de entrega",
    });

    res.json({
      success: true,
      shipping
    });
  } catch (error) {
    console.error(error);
    traceAction(res, {
      actionType: "shipping.qr_resolve",
      sourceModule: "shipping.controller",
      summary: "Falló la resolución de un QR de entrega",
    }, "failed", error);
    res.status(500).json({
      success: false,
      message: "Error al resolver QR de envío",
      error
    });
  }
};

export const transitionShippingStatusByQRController = async (req: Request, res: Response) => {
  const { payload, shippingCode, shippingId, toStatus, changedBy, note } = req.body || {};

  if (!toStatus) {
    return res.status(400).json({
      success: false,
      message: "toStatus es requerido"
    });
  }

  try {
    const auth = res.locals.auth as { id?: string; role?: string; sucursalId?: string } | undefined;
    const result = await ShippingService.transitionShippingStatusByQR({
      payload,
      shippingCode,
      shippingId,
      toStatus,
      currentBranchId: auth?.sucursalId,
      changedBy: changedBy || (auth?.id ? `${String(auth.role || "user")}:${String(auth.id)}` : undefined),
      note
    });

    traceAction(res, {
      actionType: "shipping.status_change",
      sourceModule: "shipping.controller",
      sourceId: String(shippingId || shippingCode || payload || ""),
      entityType: "shipping",
      entityId: String(shippingId || ""),
      summary: "Se cambió el estado de una entrega",
      metadata: { toStatus, note: note || null },
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Error al cambiar estado por QR";
    traceAction(res, {
      actionType: "shipping.status_change",
      sourceModule: "shipping.controller",
      sourceId: String(shippingId || shippingCode || payload || ""),
      entityType: "shipping",
      entityId: String(shippingId || ""),
      summary: "Falló el cambio de estado de una entrega",
      metadata: { toStatus, note: note || null },
    }, "failed", error);
    res.status(400).json({
      success: false,
      message,
      error
    });
  }
};

export const getShippingStatusHistoryController = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const history = await ShippingService.getShippingStatusHistory(id);
    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error al obtener historial de estados",
      error
    });
  }
};

export const markSellerWithdrawalController = async (req: Request, res: Response) => {
  const { shippingIds, externalSaleIds, withdrawnAt } = req.body || {};

  if (!Array.isArray(shippingIds) && !Array.isArray(externalSaleIds)) {
    return res.status(400).json({
      success: false,
      message: "Debe enviar shippingIds o externalSaleIds",
    });
  }

  try {
    const auth = res.locals.auth as { id?: string; role?: string; sucursalId?: string } | undefined;
    const result = await ShippingService.markSellerWithdrawal({
      shippingIds: Array.isArray(shippingIds) ? shippingIds : [],
      externalSaleIds: Array.isArray(externalSaleIds) ? externalSaleIds : [],
      withdrawnAt,
      currentBranchId: auth?.sucursalId,
      changedBy: auth?.id ? `${String(auth.role || "user")}:${String(auth.id)}` : undefined,
    });

    traceAction(res, {
      actionType: "shipping.seller_withdrawal",
      sourceModule: "shipping.controller",
      summary: "Se marcó un retiro por vendedor",
      metadata: {
        shippingCount: Array.isArray(shippingIds) ? shippingIds.length : 0,
        externalSaleCount: Array.isArray(externalSaleIds) ? externalSaleIds.length : 0,
      },
    });

    res.json(result);
  } catch (error: any) {
    console.error(error);
    traceAction(res, {
      actionType: "shipping.seller_withdrawal",
      sourceModule: "shipping.controller",
      summary: "Falló el marcado de retiro por vendedor",
      metadata: {
        shippingCount: Array.isArray(shippingIds) ? shippingIds.length : 0,
        externalSaleCount: Array.isArray(externalSaleIds) ? externalSaleIds.length : 0,
      },
    }, "failed", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Error al marcar retiro por vendedor",
      error,
    });
  }
};

export const rejectCatalogOrderController = async (req: Request, res: Response) => {
  try {
    const auth = res.locals.auth as { id?: string; role?: string } | undefined;
    const rejectedBy = `${String(auth?.role || "user")}:${String(auth?.id || "")}`;
    const order = await CatalogOrderIntegrationService.rejectOrder(
      req.params.id,
      String(req.body?.reason || ""),
      rejectedBy
    );
    return res.json({ success: true, order });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error?.message || "No se pudo rechazar" });
  }
};

export const ShippingController = {
  updateShipping,
  getShippingById,
  getSalesHistory
};
