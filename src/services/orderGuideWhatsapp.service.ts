import { IVentaExterna } from "../entities/IVentaExterna";
import { ExternalSaleRepository } from "../repositories/external.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";
import { sendTemplateMessage, sendTextMessage } from "../api/whatsapp/whatsapp";

type SendAttempt = {
  type: "seller" | "buyer";
  orderId?: string;
  guide?: string;
  phone?: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  response?: any;
};

const toTrimmed = (value: unknown) => String(value ?? "").trim();

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

const getBranchName = (value: any, fallback = "") =>
  toTrimmed(value?.nombre ?? fallback);

const getDestinationName = (row: any) =>
  getBranchName(row?.destino_sucursal, toTrimmed(row?.lugar_entrega) || "la sucursal indicada");

const getGuide = (row: any) => toTrimmed(row?.numero_guia);

const getCurrentDateLabel = () =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/La_Paz",
  }).format(new Date());

const buildTemplateSecondParameter = (message: string, guide?: string) => {
  const fallback = toTrimmed(guide) || "Sin guia";
  const compact = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" | ");
  return compact.length > 900 ? fallback : compact || fallback;
};

const sendSafely = async (params: {
  type: "seller" | "buyer";
  orderId?: string;
  guide?: string;
  phone?: string;
  message: string;
}): Promise<SendAttempt> => {
  const phone = normalizeWhatsAppPhone(params.phone);
  if (!phone) {
    return {
      type: params.type,
      orderId: params.orderId,
      guide: params.guide,
      phone: params.phone,
      success: false,
      skipped: true,
      reason: "Telefono no registrado",
    };
  }

  try {
    const templateName = toTrimmed(process.env.W_GUIDE_TEMPLATE_NAME);
    const languageCode = toTrimmed(process.env.W_GUIDE_TEMPLATE_LANGUAGE) || "en_US";
    const response = templateName
      ? await sendTemplateMessage({
          phone,
          templateName,
          languageCode,
          bodyParameters: [
            { type: "text", text: params.type === "seller" ? "Vendedor" : "Cliente" },
            { type: "text", text: buildTemplateSecondParameter(params.message, params.guide) },
            { type: "text", text: getCurrentDateLabel() },
          ],
        })
      : await sendTextMessage(phone, params.message);
    return {
      type: params.type,
      orderId: params.orderId,
      guide: params.guide,
      phone,
      success: response.success,
      status: response.status,
      response: response.data,
      reason: response.success ? undefined : "WhatsApp API rechazo el mensaje",
    };
  } catch (error: any) {
    return {
      type: params.type,
      orderId: params.orderId,
      guide: params.guide,
      phone,
      success: false,
      reason: error?.message || "No se pudo enviar el mensaje",
    };
  }
};

const buildSellerMessage = (sellerName: string, rows: any[]) => {
  const lines = rows.map((row, index) => {
    const buyer = toTrimmed(row?.comprador) || "Sin comprador";
    const description = toTrimmed(row?.descripcion_paquete) || "Paquete";
    return `${index + 1}. Guia ${getGuide(row)} - ${buyer} - ${description} - Destino: ${getDestinationName(row)}`;
  });

  return [
    `Hola ${sellerName || "vendedor"}, estos son los pedidos registrados con numero de guia:`,
    ...lines,
    "Tu Punto",
  ].join("\n");
};

const buildBuyerMessage = (row: any) => {
  const buyerName = toTrimmed(row?.comprador) || "cliente";
  return [
    `Hola ${buyerName}.`,
    `Tu pedido ya tiene numero de guia ${getGuide(row)}.`,
    `Puedes pasar a recogerlo en ${getDestinationName(row)}. Presenta tu numero de guia al recoger.`,
    "Tu Punto",
  ].join("\n");
};

const ensureGuides = (rows: any[]) => {
  const missingGuide = rows.filter((row) => !getGuide(row));
  if (missingGuide.length) {
    throw new Error("Todos los pedidos deben tener numero de guia antes de enviar WhatsApp");
  }
};

const sendForRows = async (rows: any[]) => {
  ensureGuides(rows);

  const sellerRows = rows.filter((row) => normalizeWhatsAppPhone(row?.telefono_vendedor));
  const firstSeller = sellerRows[0] || rows[0];
  const attempts: SendAttempt[] = [];

  if (firstSeller) {
    attempts.push(
      await sendSafely({
        type: "seller",
        phone: firstSeller.telefono_vendedor,
        message: buildSellerMessage(toTrimmed(firstSeller.vendedor), rows),
      })
    );
  }

  for (const row of rows) {
    attempts.push(
      await sendSafely({
        type: "buyer",
        orderId: String(row?._id || ""),
        guide: getGuide(row),
        phone: row?.telefono_comprador,
        message: buildBuyerMessage(row),
      })
    );
  }

  return {
    success: attempts.some((attempt) => attempt.success),
    sentCount: attempts.filter((attempt) => attempt.success).length,
    skippedCount: attempts.filter((attempt) => attempt.skipped).length,
    failedCount: attempts.filter((attempt) => !attempt.success && !attempt.skipped).length,
    attempts,
  };
};

const sendExternalGuideMessages = async (id: string) => {
  const row = await ExternalSaleRepository.getExternalSaleByID(id);
  if (!row) throw new Error("Pedido externo no encontrado");
  return sendForRows([row as IVentaExterna]);
};

const sendSimplePackageGuideMessages = async (params: {
  packageIds: string[];
  role: string;
  authSellerId?: string;
  currentBranchId?: string;
}) => {
  const packageIds = (params.packageIds || []).map((id) => toTrimmed(id)).filter(Boolean);
  if (!packageIds.length) throw new Error("Debe seleccionar al menos un paquete");

  const role = toTrimmed(params.role).toLowerCase();
  const rows = await SimplePackageRepository.getSimplePackagesByIDs(packageIds);
  const pendingRows = rows.filter((row: any) => !row?.is_external);
  if (!pendingRows.length) throw new Error("No hay paquetes simples pendientes para notificar");

  if (
    role === "seller" &&
    pendingRows.some((row: any) => String(row?.id_vendedor || "") !== String(params.authSellerId || ""))
  ) {
    throw new Error("No autorizado para enviar estos paquetes");
  }

  if (
    (role === "admin" || role === "operator") &&
    params.currentBranchId &&
    pendingRows.some((row: any) => String((row?.origen_sucursal as any)?._id || row?.origen_sucursal || "") !== String(params.currentBranchId))
  ) {
    throw new Error("Solo puedes enviar WhatsApp de paquetes de tu sucursal actual");
  }

  return sendForRows(pendingRows);
};

export const OrderGuideWhatsappService = {
  sendExternalGuideMessages,
  sendSimplePackageGuideMessages,
};
