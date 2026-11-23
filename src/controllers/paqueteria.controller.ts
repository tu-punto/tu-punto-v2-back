import { Request, Response } from "express";
import { Types } from "mongoose";
import { extname } from "path";
import { PaqueteriaModel } from "../entities/implements/PaqueteriaSchema";
import { uploadFileToAws } from "../services/bucket.service";

const cleanNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizePayload = (input: any) => ({
  nombre: String(input?.nombre || "").trim(),
  activo: input?.activo !== false,
  codigo_guia: Math.floor(cleanNumber(input?.codigo_guia)),
  logo_url: String(input?.logo_url || "").trim(),
  color_primario: String(input?.color_primario || "").trim(),
  color_secundario: String(input?.color_secundario || "").trim(),
  tarifa_fija: cleanNumber(input?.tarifa_fija),
  multa_cada_dias: Math.floor(cleanNumber(input?.multa_cada_dias)),
  monto_multa: cleanNumber(input?.monto_multa),
  rutas_habilitadas: (Array.isArray(input?.rutas_habilitadas) ? input.rutas_habilitadas : [])
    .map(String)
    .filter(Types.ObjectId.isValid)
    .map((id: string) => new Types.ObjectId(id)),
});

const validate = (data: ReturnType<typeof normalizePayload>) => {
  if (!data.nombre) throw new Error("El nombre es obligatorio");
  if (data.codigo_guia < 2) throw new Error("El codigo de guia debe ser 2 o mayor");
  if (data.tarifa_fija < 0 || data.monto_multa < 0) throw new Error("Los montos no pueden ser negativos");
  if (data.multa_cada_dias < 1) throw new Error("La multa debe tener un intervalo de al menos un dia");
};

export const listPaqueterias = async (_req: Request, res: Response) => {
  const data = await PaqueteriaModel.find().sort({ nombre: 1 }).lean();
  return res.json({ success: true, data });
};

export const checkGuideCodeAvailability = async (req: Request, res: Response) => {
  const codigoGuia = Math.floor(cleanNumber(req.query.codigo_guia));
  const excludeId = String(req.query.excludeId || "").trim();
  if (codigoGuia < 2) {
    return res.status(400).json({ success: false, msg: "El codigo de guia debe ser 2 o mayor" });
  }

  const query: Record<string, unknown> = { codigo_guia: codigoGuia };
  if (Types.ObjectId.isValid(excludeId)) query._id = { $ne: new Types.ObjectId(excludeId) };
  const exists = await PaqueteriaModel.exists(query);
  return res.json({ success: true, available: !exists });
};

export const createPaqueteria = async (req: Request, res: Response) => {
  try {
    const data = normalizePayload(req.body);
    validate(data);
    const created = await PaqueteriaModel.create(data);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(400).json({ success: false, msg: error?.code === 11000 ? "El codigo de guia ya existe" : error?.message });
  }
};

export const updatePaqueteria = async (req: Request, res: Response) => {
  try {
    const data = normalizePayload(req.body);
    validate(data);
    const updated = await PaqueteriaModel.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, msg: "Paqueteria no encontrada" });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, msg: error?.code === 11000 ? "El codigo de guia ya existe" : error?.message });
  }
};

export const uploadPaqueteriaLogo = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: "Debes enviar un logo" });

    const paqueteria = await PaqueteriaModel.findById(req.params.id);
    if (!paqueteria) return res.status(404).json({ success: false, msg: "Paqueteria no encontrada" });

    const extension = extname(req.file.originalname).toLowerCase() || ".webp";
    const logoUrl = await uploadFileToAws(
      req.file.buffer,
      `paqueterias/logos/${paqueteria._id}-${Date.now()}${extension}`,
      req.file.mimetype,
    );
    paqueteria.logo_url = logoUrl;
    await paqueteria.save();
    return res.json({ success: true, data: paqueteria, logo_url: logoUrl });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, msg: error?.message || "No se pudo subir el logo" });
  }
};

export const getMyPaqueteria = async (_req: Request, res: Response) => {
  const id = String(res.locals.auth?.paqueteriaId || "");
  const data = Types.ObjectId.isValid(id) ? await PaqueteriaModel.findById(id).lean() : null;
  if (!data || data.activo === false) return res.status(403).json({ success: false, msg: "Paqueteria no habilitada" });
  return res.json({ success: true, data });
};
