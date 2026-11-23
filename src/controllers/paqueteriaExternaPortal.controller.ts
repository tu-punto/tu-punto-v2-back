import { Request, Response } from "express";
import { Types } from "mongoose";
import { PaqueteriaModel } from "../entities/implements/PaqueteriaSchema";
import { PedidoPaqueteriaExternaModel } from "../entities/implements/PedidoPaqueteriaExternaSchema";

const company = async (res: Response) => PaqueteriaModel.findOne({ _id: res.locals.auth?.paqueteriaId, tipo: "externa", activo: true }).lean();
const validGuide = (courier: any, value: unknown) => {
  const guide = String(value || "").trim(); if (!guide) throw new Error("La guía propia es obligatoria");
  if (courier.formato_guia === "tupunto" && !/^EXT-\d{6}$/.test(guide)) throw new Error("La guía debe usar el formato EXT-000001");
  if (courier.formato_guia === "personalizado" && courier.prefijo_guia && !guide.startsWith(courier.prefijo_guia)) throw new Error(`La guía debe comenzar con ${courier.prefijo_guia}`);
  return guide;
};
export const listExternalOrders = async (_req: Request, res: Response) => {
  const rows = await PedidoPaqueteriaExternaModel.find({ paqueteria: res.locals.auth?.paqueteriaId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: rows });
};
export const createExternalOrder = async (req: Request, res: Response) => {
  try { const courier = await company(res); if (!courier) return res.status(403).json({ success: false, msg: "Paquetería externa no habilitada" });
    const row = await PedidoPaqueteriaExternaModel.create({ paqueteria: courier._id, guia_propia: validGuide(courier, req.body?.guia_propia), destinatario: String(req.body?.destinatario || "").trim(), telefono: String(req.body?.telefono || "").trim(), descripcion: String(req.body?.descripcion || "").trim() });
    if (!row.destinatario || !row.descripcion) throw new Error("Destinatario y descripción son obligatorios"); res.status(201).json({ success: true, data: row });
  } catch (error: any) { res.status(400).json({ success: false, msg: error?.code === 11000 ? "Esa guía ya existe" : error?.message }); }
};
export const updateExternalOrder = async (req: Request, res: Response) => {
  try { const courier = await company(res); if (!courier) return res.status(403).json({ success: false, msg: "Paquetería externa no habilitada" });
    const data: any = { destinatario: String(req.body?.destinatario || "").trim(), telefono: String(req.body?.telefono || "").trim(), descripcion: String(req.body?.descripcion || "").trim() }; if (req.body?.guia_propia !== undefined) data.guia_propia = validGuide(courier, req.body.guia_propia);
    const row = await PedidoPaqueteriaExternaModel.findOneAndUpdate({ _id: req.params.id, paqueteria: courier._id }, data, { new: true }); if (!row) return res.status(404).json({ success: false, msg: "Pedido no encontrado" }); res.json({ success: true, data: row });
  } catch (error: any) { res.status(400).json({ success: false, msg: error?.code === 11000 ? "Esa guía ya existe" : error?.message }); }
};
export const annulExternalOrder = async (req: Request, res: Response) => { const row = await PedidoPaqueteriaExternaModel.findOneAndUpdate({ _id: req.params.id, paqueteria: res.locals.auth?.paqueteriaId }, { anulado: true, anulado_en: new Date() }, { new: true }); if (!row) return res.status(404).json({ success: false, msg: "Pedido no encontrado" }); res.json({ success: true, data: row }); };
