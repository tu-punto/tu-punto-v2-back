import { IVentaExterna } from "../entities/IVentaExterna";
import { ExternalSaleRepository } from "../repositories/external.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";
import { sendTemplateMessage } from "../api/whatsapp/whatsapp";
import { getEstimatedBranchPickupDateLabel } from "../utils/latePickupFee";

type SendAttempt = {
  type: "seller" | "buyer";
  template?: string;
  orderId?: string;
  guide?: string;
  phone?: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  response?: any;
};

const DEFAULT_BUYER_SAME_BRANCH_TEMPLATE = "pedido_recojo_sucursal";
const DEFAULT_BUYER_TRANSFER_TEMPLATE = "pedido_listo_traslado";
const DEFAULT_SELLER_TEMPLATE = "paquetes_entregados_sucursal";
const GUIDE_WHATSAPP_MESSAGES_DISABLED = process.env.W_DISABLE_GUIDE_WHATSAPP_MESSAGES !== undefined;

const logGuideWhatsapp = (context: string, event: string, payload?: Record<string, any>) => {
  console.log(`[${context}] ${event}`, payload || {});
};

const BRANCH_LOCATION_LINKS = [
  {
    matches: ["cocha", "cochabamba"],
    url: "https://maps.app.goo.gl/FY8Vq7GXRhqFfTkd6?g_st=aw",
    buttonValue: "FY8Vq7GXRhqFfTkd6",
  },
  {
    matches: ["el alto", "alto"],
    url: "https://maps.app.goo.gl/duiU5jLPo6T8qKKB7?g_st=aw",
    buttonValue: "duiU5jLPo6T8qKKB7",
  },
  {
    matches: ["zona sur", "sur"],
    url: "https://maps.app.goo.gl/1hVSnso3suMxmfcP6?g_st=aw",
    buttonValue: "1hVSnso3suMxmfcP6",
  },
  {
    matches: ["santa", "santa cruz"],
    url: "https://maps.app.goo.gl/FbnHrTAK4D7EBwmL9?g_st=aw",
    buttonValue: "FbnHrTAK4D7EBwmL9",
  },
  {
    matches: ["el prado", "prado"],
    url: "https://maps.app.goo.gl/Yc3QL4FdZXyz2qqp7?g_st=aw",
    buttonValue: "Yc3QL4FdZXyz2qqp7",
  },
];

const toTrimmed = (value: unknown) => String(value ?? "").trim();
const sanitizeTemplateText = (value: unknown) =>
  toTrimmed(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ");
const templateParam = (value: unknown) => ({ type: "text" as const, text: sanitizeTemplateText(value) });

const normalizeWhatsAppPhone = (value: unknown): string => {
  const raw = toTrimmed(value);
  if (!raw) return "";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (hasPlus) return digits;
  if (digits.length === 8) return `591${digits}`;
  return digits;
};

const normalizeName = (value: unknown): string =>
  toTrimmed(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const getBranchName = (value: any, fallback = "") =>
  toTrimmed(value?.nombre ?? fallback);

const getOriginName = (row: any) =>
  getBranchName(row?.origen_sucursal, getBranchName(row?.sucursal, "la sucursal de origen"));

const getDestinationName = (row: any) =>
  getBranchName(row?.destino_sucursal, toTrimmed(row?.lugar_entrega) || "la sucursal de destino");

const getBranchId = (value: any): string => toTrimmed(value?._id ?? value);
const getOriginId = (row: any) => getBranchId(row?.origen_sucursal) || getBranchId(row?.sucursal);
const getDestinationId = (row: any) => getBranchId(row?.destino_sucursal) || getBranchId(row?.sucursal);
const isSameBranchDelivery = (row: any) => {
  const originId = getOriginId(row);
  const destinationId = getDestinationId(row);
  if (originId && destinationId) return originId === destinationId;
  return normalizeName(getOriginName(row)) === normalizeName(getDestinationName(row));
};

const getGuide = (row: any) => toTrimmed(row?.numero_guia);

const getBranchLocationLink = (branchName: string) => {
  const normalized = normalizeName(branchName);
  return BRANCH_LOCATION_LINKS.find((entry) =>
    entry.matches.some((match) => normalized.includes(normalizeName(match)))
  )?.url || "";
};

const getBranchLocationButtonValue = (branchName: string) => {
  const normalized = normalizeName(branchName);
  const matchedValue = BRANCH_LOCATION_LINKS.find((entry) =>
    entry.matches.some((match) => normalized.includes(normalizeName(match)))
  )?.buttonValue;

  if (matchedValue) return matchedValue;

  return toTrimmed(process.env.W_DEFAULT_BRANCH_LOCATION_BUTTON_VALUE) || BRANCH_LOCATION_LINKS[0].buttonValue;
};

const compactGuideList = (rows: any[]) =>
  rows
    .map((row, index) => `${index + 1}. ${getGuide(row)}`)
    .join(" | ");

const sendBuyerTemplate = async (row: any): Promise<SendAttempt> => {
  const phone = normalizeWhatsAppPhone(row?.telefono_comprador);
  const guide = getGuide(row);
  const buyerName = toTrimmed(row?.comprador) || "cliente";
  const destinationName = getDestinationName(row);
  const locationButtonValue = getBranchLocationButtonValue(destinationName);
  const sameBranch = isSameBranchDelivery(row);
  const templateName = sameBranch
    ? toTrimmed(process.env.W_BUYER_SAME_BRANCH_TEMPLATE_NAME) || DEFAULT_BUYER_SAME_BRANCH_TEMPLATE
    : toTrimmed(process.env.W_BUYER_TRANSFER_TEMPLATE_NAME) || DEFAULT_BUYER_TRANSFER_TEMPLATE;
  const languageCode = toTrimmed(process.env.W_GUIDE_TEMPLATE_LANGUAGE) || "es";

  logGuideWhatsapp("guide-whatsapp", "buyer-template:prepare", {
    orderId: String(row?._id || ""),
    guide,
    phone,
    templateName,
    sameBranch,
  });

  if (!phone) {
    logGuideWhatsapp("guide-whatsapp", "buyer-template:skip", {
      orderId: String(row?._id || ""),
      guide,
      reason: "Telefono del comprador no registrado",
    });
    return {
      type: "buyer",
      template: templateName,
      orderId: String(row?._id || ""),
      guide,
      phone: row?.telefono_comprador,
      success: false,
      skipped: true,
      reason: "Telefono del comprador no registrado",
    };
  }

  try {
    const bodyParameters = sameBranch
      ? [templateParam(buyerName), templateParam(destinationName), templateParam(guide)]
      : [
          templateParam(buyerName),
          templateParam(getOriginName(row)),
          templateParam(destinationName),
          templateParam(guide),
          templateParam(getEstimatedBranchPickupDateLabel(row?.fecha_pedido)),
        ];
    const response = await sendTemplateMessage({
      phone,
      templateName,
      languageCode,
      bodyParameters,
      buttonUrlParameters: locationButtonValue ? [templateParam(locationButtonValue)] : undefined,
    });

    logGuideWhatsapp("guide-whatsapp", "buyer-template:result", {
      orderId: String(row?._id || ""),
      guide,
      phone,
      templateName,
      success: response.success,
      status: response.status,
      response: response.data,
    });

    return {
      type: "buyer",
      template: templateName,
      orderId: String(row?._id || ""),
      guide,
      phone,
      success: response.success,
      status: response.status,
      response: response.data,
      reason: response.success ? undefined : "WhatsApp API rechazo el mensaje",
    };
  } catch (error: any) {
    logGuideWhatsapp("guide-whatsapp", "buyer-template:error", {
      orderId: String(row?._id || ""),
      guide,
      phone,
      templateName,
      error: error?.message || String(error),
    });
    return {
      type: "buyer",
      template: templateName,
      orderId: String(row?._id || ""),
      guide,
      phone,
      success: false,
      reason: error?.message || "No se pudo enviar el mensaje al comprador",
    };
  }
};

const sendSellerTemplate = async (rows: any[]): Promise<SendAttempt> => {
  const firstSeller = rows.find((row) => normalizeWhatsAppPhone(row?.telefono_vendedor)) || rows[0];
  const sellerName = toTrimmed(firstSeller?.vendedor) || "vendedor";
  const originName = getOriginName(firstSeller);
  const phone = normalizeWhatsAppPhone(firstSeller?.telefono_vendedor);
  const templateName = toTrimmed(process.env.W_SELLER_PACKAGES_TEMPLATE_NAME) || DEFAULT_SELLER_TEMPLATE;
  const languageCode = toTrimmed(process.env.W_GUIDE_TEMPLATE_LANGUAGE) || "es";
  const guideList = compactGuideList(rows);

  logGuideWhatsapp("guide-whatsapp", "seller-template:prepare", {
    rowsCount: rows.length,
    phone,
    templateName,
    guideList,
  });

  if (!phone) {
    logGuideWhatsapp("guide-whatsapp", "seller-template:skip", {
      rowsCount: rows.length,
      reason: "Telefono del vendedor no registrado",
    });
    return {
      type: "seller",
      template: templateName,
      phone: firstSeller?.telefono_vendedor,
      success: false,
      skipped: true,
      reason: "Telefono del vendedor no registrado",
    };
  }

  try {
    const bodyParameters = [
      templateParam(sellerName),
      templateParam(originName),
      templateParam(guideList),
    ];

    const response = await sendTemplateMessage({
      phone,
      templateName,
      languageCode,
      bodyParameters,
    });

    logGuideWhatsapp("guide-whatsapp", "seller-template:result", {
      rowsCount: rows.length,
      phone,
      templateName,
      success: response.success,
      status: response.status,
      response: response.data,
    });

    return {
      type: "seller",
      template: templateName,
      phone,
      success: response.success,
      status: response.status,
      response: response.data,
      reason: response.success ? undefined : "WhatsApp API rechazo el mensaje",
    };
  } catch (error: any) {
    logGuideWhatsapp("guide-whatsapp", "seller-template:error", {
      rowsCount: rows.length,
      phone,
      templateName,
      error: error?.message || String(error),
    });
    return {
      type: "seller",
      template: templateName,
      phone,
      success: false,
      reason: error?.message || "No se pudo enviar el mensaje al vendedor",
    };
  }
};

const ensureGuides = (rows: any[]) => {
  const missingGuide = rows.filter((row) => !getGuide(row));
  if (missingGuide.length) {
    throw new Error("Todos los pedidos deben tener numero de guia antes de enviar WhatsApp");
  }
};

const sendForRows = async (rows: any[]) => {
  logGuideWhatsapp("guide-whatsapp", "sendForRows:start", {
    rowsCount: rows.length,
    disabled: GUIDE_WHATSAPP_MESSAGES_DISABLED,
    orderIds: rows.map((row) => String(row?._id || "")).filter(Boolean),
  });
  ensureGuides(rows);

  const attempts: SendAttempt[] = [];

  if (GUIDE_WHATSAPP_MESSAGES_DISABLED) {
    logGuideWhatsapp("guide-whatsapp", "sendForRows:disabled", {
      rowsCount: rows.length,
      reason: "Envios de WhatsApp deshabilitados por configuracion",
    });
    if (rows.length) {
      attempts.push({
        type: "seller",
        template: toTrimmed(process.env.W_SELLER_PACKAGES_TEMPLATE_NAME) || DEFAULT_SELLER_TEMPLATE,
        phone: rows[0]?.telefono_vendedor,
        success: false,
        skipped: true,
        reason: "Envios de WhatsApp deshabilitados por configuracion",
      });
    }

    for (const row of rows) {
      const templateName = isSameBranchDelivery(row)
        ? toTrimmed(process.env.W_BUYER_SAME_BRANCH_TEMPLATE_NAME) || DEFAULT_BUYER_SAME_BRANCH_TEMPLATE
        : toTrimmed(process.env.W_BUYER_TRANSFER_TEMPLATE_NAME) || DEFAULT_BUYER_TRANSFER_TEMPLATE;
      attempts.push({
        type: "buyer",
        template: templateName,
        orderId: String(row?._id || ""),
        guide: getGuide(row),
        phone: row?.telefono_comprador,
        success: false,
        skipped: true,
        reason: "Envios de WhatsApp deshabilitados por configuracion",
      });
    }
  } else {
    if (rows.length) {
      const sellerAttempt = await sendSellerTemplate(rows);
      attempts.push(sellerAttempt);
    }

    for (const row of rows) {
      const buyerAttempt = await sendBuyerTemplate(row);
      attempts.push(buyerAttempt);
    }
  }

  logGuideWhatsapp("guide-whatsapp", "sendForRows:done", {
    rowsCount: rows.length,
    successCount: attempts.filter((attempt) => attempt.success).length,
    skippedCount: attempts.filter((attempt) => attempt.skipped).length,
    failedCount: attempts.filter((attempt) => !attempt.success && !attempt.skipped).length,
  });

  return {
    success: attempts.some((attempt) => attempt.success),
    sentCount: attempts.filter((attempt) => attempt.success).length,
    skippedCount: attempts.filter((attempt) => attempt.skipped).length,
    failedCount: attempts.filter((attempt) => !attempt.success && !attempt.skipped).length,
    attempts,
  };
};

const sendForRowsBestEffort = async (rows: any[], context = "order-guide-whatsapp") => {
  try {
    logGuideWhatsapp(context, "bestEffort:start", {
      rowsCount: rows.length,
      orderIds: rows.map((row) => String(row?._id || "")).filter(Boolean),
    });
    const result = await sendForRows(rows);
    logGuideWhatsapp(context, "bestEffort:result", result as any);
    return result;
  } catch (error) {
    console.error(`[${context}] bestEffort:error`, error);
    return {
      success: false,
      sentCount: 0,
      skippedCount: 0,
      failedCount: rows.length,
      attempts: [],
    };
  }
};

const sendExternalGuideMessages = async (id: string) => {
  logGuideWhatsapp("external-guide-whatsapp", "manual-send:start", { id });
  const row = await ExternalSaleRepository.getExternalSaleByID(id);
  if (!row) {
    logGuideWhatsapp("external-guide-whatsapp", "manual-send:missing-order", { id });
    throw new Error("Pedido externo no encontrado");
  }
  return sendForRows([row as IVentaExterna]);
};

const sendExternalRowsBestEffort = async (rows: any[]) =>
  sendForRowsBestEffort(rows, "external-guide-whatsapp");

const sendSimplePackageGuideMessages = async (params: {
  packageIds: string[];
  role: string;
  authSellerId?: string;
  currentBranchId?: string;
}) => {
  const packageIds = (params.packageIds || []).map((id) => toTrimmed(id)).filter(Boolean);
  logGuideWhatsapp("simple-package-guide-whatsapp", "manual-send:start", {
    packageIds,
    role: params.role,
    authSellerId: params.authSellerId,
    currentBranchId: params.currentBranchId,
  });
  if (!packageIds.length) throw new Error("Debe seleccionar al menos un paquete");

  const role = toTrimmed(params.role).toLowerCase();
  const rows = await SimplePackageRepository.getSimplePackagesByIDs(packageIds);
  const pendingRows = rows.filter((row: any) => !row?.is_external);
  if (!pendingRows.length) {
    logGuideWhatsapp("simple-package-guide-whatsapp", "manual-send:no-pending-rows", { packageIds });
    throw new Error("No hay paquetes simples pendientes para notificar");
  }

  if (
    role === "seller" &&
    pendingRows.some((row: any) => String(row?.id_vendedor || "") !== String(params.authSellerId || ""))
  ) {
    logGuideWhatsapp("simple-package-guide-whatsapp", "manual-send:unauthorized-seller", {
      packageIds,
      authSellerId: params.authSellerId,
    });
    throw new Error("No autorizado para enviar estos paquetes");
  }

  if (
    (role === "admin" || role === "operator") &&
    params.currentBranchId &&
    pendingRows.some((row: any) => String((row?.origen_sucursal as any)?._id || row?.origen_sucursal || "") !== String(params.currentBranchId))
  ) {
    logGuideWhatsapp("simple-package-guide-whatsapp", "manual-send:unauthorized-branch", {
      packageIds,
      currentBranchId: params.currentBranchId,
    });
    throw new Error("Solo puedes enviar WhatsApp de paquetes de tu sucursal actual");
  }

  return sendForRows(pendingRows);
};

export const OrderGuideWhatsappService = {
  sendExternalGuideMessages,
  sendExternalRowsBestEffort,
  sendSimplePackageGuideMessages,
  sendForRowsBestEffort,
};
