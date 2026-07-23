import {
  ensurePlainObject,
  parseObjectId,
  parseOptionalBoolean,
  parseOptionalJson,
  parseOptionalString,
  parseOptionalUrl,
  parseStringArray,
  rejectUnexpectedKeys,
  RequestValidationError,
} from "./requestValidation";

const SERVICE_ANNOUNCEMENT_ROLES = ["admin", "operator", "seller"] as const;

export const validateShippingGuideBody = (input: unknown, role?: string, sellerId?: string) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["vendedor", "sucursal", "descripcion"], "body");

  const normalizedRole = String(role || "").toLowerCase();
  const targetSellerId = payload.vendedor ? parseObjectId(payload.vendedor, "vendedor") : undefined;
  const authenticatedSellerId = String(sellerId || "").trim();

  if (normalizedRole === "seller" && !targetSellerId && !authenticatedSellerId) {
    throw new RequestValidationError("No se pudo identificar el vendedor");
  }

  return {
    ...(targetSellerId ? { vendedor: targetSellerId } : {}),
    sucursal: parseObjectId(payload.sucursal, "sucursal"),
    ...(payload.descripcion !== undefined
      ? { descripcion: parseOptionalString(payload.descripcion, "descripcion", { maxLength: 500 }) || "" }
      : {}),
  };
};

export const validateServiceAnnouncementBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(
    payload,
    ["title", "version", "summary", "body", "regulation", "policyText", "targetRoles", "requireAcceptance", "sendPush", "publishNow", "linkAttachments"],
    "body"
  );

  const targetRolesRaw = parseOptionalJson(payload.targetRoles, "targetRoles");
  const linkAttachmentsRaw = parseOptionalJson(payload.linkAttachments, "linkAttachments");

  const targetRoles = parseStringArray(targetRolesRaw, "targetRoles", {
    allowCsv: false,
    maxItems: 10,
    itemMaxLength: 40,
  }) || [];

  targetRoles.forEach((role) => {
    if (!SERVICE_ANNOUNCEMENT_ROLES.includes(role as (typeof SERVICE_ANNOUNCEMENT_ROLES)[number])) {
      throw new RequestValidationError("targetRoles contiene valores invalidos");
    }
  });

  const links = Array.isArray(linkAttachmentsRaw) ? linkAttachmentsRaw : [];
  const normalizedLinks = links.map((link, index) => {
    const item = ensurePlainObject(link, `linkAttachments[${index}]`);
    rejectUnexpectedKeys(item, ["title", "url"], `linkAttachments[${index}]`);
    return {
      ...(item.title ? { title: parseOptionalString(item.title, `linkAttachments[${index}].title`, { maxLength: 120 }) } : {}),
      url: parseOptionalUrl(item.url, `linkAttachments[${index}].url`) || (() => { throw new RequestValidationError(`linkAttachments[${index}].url es requerido`); })(),
    };
  });

  return {
    title: parseOptionalString(payload.title, "title", { maxLength: 160 }) || (() => { throw new RequestValidationError("title es requerido"); })(),
    version: parseOptionalString(payload.version, "version", { maxLength: 40 }) || (() => { throw new RequestValidationError("version es requerido"); })(),
    body: parseOptionalString(payload.body, "body", { maxLength: 20000 }) || (() => { throw new RequestValidationError("body es requerido"); })(),
    ...(payload.summary !== undefined ? { summary: parseOptionalString(payload.summary, "summary", { maxLength: 500 }) || "" } : {}),
    ...(payload.regulation !== undefined ? { regulation: parseOptionalString(payload.regulation, "regulation", { maxLength: 2000 }) || "" } : {}),
    ...(payload.policyText !== undefined ? { policyText: parseOptionalString(payload.policyText, "policyText", { maxLength: 10000 }) || "" } : {}),
    targetRoles,
    ...(payload.requireAcceptance !== undefined ? { requireAcceptance: parseOptionalBoolean(payload.requireAcceptance) } : {}),
    ...(payload.sendPush !== undefined ? { sendPush: parseOptionalBoolean(payload.sendPush) } : {}),
    ...(payload.publishNow !== undefined ? { publishNow: parseOptionalBoolean(payload.publishNow) } : {}),
    ...(normalizedLinks.length ? { linkAttachments: normalizedLinks } : {}),
  };
};
