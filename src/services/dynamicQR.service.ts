import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { DynamicQRModel } from "../entities/implements/DynamicQRSchema";

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://www.tu-punto.com").replace(/\/$/, "");

const invalidDestination = () => new Error("El destino debe ser una URL HTTPS o una ruta interna valida");

export const normalizeDynamicQRDestination = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) throw invalidDestination();

  if (raw.startsWith("/")) return new URL(raw, `${PUBLIC_SITE_URL}/`).toString();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalidDestination();
  }
  if (url.protocol !== "https:") throw invalidDestination();
  return url.toString();
};

export const getDynamicQRPublicUrl = (code: string) => `${PUBLIC_SITE_URL}/q/${code}`;

const createUniqueCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomBytes(6).toString("base64url").toUpperCase();
    if (!(await DynamicQRModel.exists({ code }))) return code;
  }
  throw new Error("No se pudo generar un codigo QR unico");
};

export const DynamicQRService = {
  async create(input: { name: unknown; destinationUrl: unknown; active?: unknown; createdBy: string }) {
    const name = String(input.name || "").trim();
    if (!name) throw new Error("El nombre es obligatorio");
    const item = await DynamicQRModel.create({
      code: await createUniqueCode(),
      name,
      destinationUrl: normalizeDynamicQRDestination(input.destinationUrl),
      active: input.active !== false,
      createdBy: input.createdBy,
    });
    return item;
  },

  async list(input: { q?: unknown; active?: unknown; page?: unknown; limit?: unknown }) {
    const page = Math.max(1, Number(input.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
    const filter: Record<string, unknown> = {};
    const q = String(input.q || "").trim();
    if (q) filter.$text = { $search: q };
    if (input.active === "true" || input.active === "false") filter.active = input.active === "true";
    const [rows, total] = await Promise.all([
      DynamicQRModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      DynamicQRModel.countDocuments(filter),
    ]);
    return { rows, total, page, limit };
  },

  async update(id: string, input: { name?: unknown; destinationUrl?: unknown; active?: unknown }) {
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (!name) throw new Error("El nombre es obligatorio");
      update.name = name;
    }
    if (input.destinationUrl !== undefined) update.destinationUrl = normalizeDynamicQRDestination(input.destinationUrl);
    if (typeof input.active === "boolean") update.active = input.active;
    const item = await DynamicQRModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!item) throw new Error("QR no encontrado");
    return item;
  },

  async resolve(code: string) {
    return DynamicQRModel.findOne({ code: String(code || "").trim(), active: true }).lean();
  },

  async findByCode(code: string) {
    return DynamicQRModel.findOne({ code: String(code || "").trim() }).lean();
  },

  async png(code: string) {
    return QRCode.toBuffer(getDynamicQRPublicUrl(code), { type: "png", width: 1200, margin: 2, errorCorrectionLevel: "M" });
  },
};
