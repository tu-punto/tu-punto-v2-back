import { Request, Response } from "express";
import moment from "moment-timezone";
import { Types } from "mongoose";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { PaqueteriaModel } from "../entities/implements/PaqueteriaSchema";
import { OrderGuideService } from "../services/orderGuide.service";

const tz = "America/La_Paz";
const money = (value: unknown) => +Math.max(0, Number(value || 0)).toFixed(2);
const courierId = (res: Response) => String(res.locals.auth?.paqueteriaId || "");
const getCourier = async (res: Response) => {
  const id = courierId(res);
  return Types.ObjectId.isValid(id) ? PaqueteriaModel.findOne({ _id: id, activo: true }).lean() : null;
};
const calculateFine = (row: any, now = new Date()) => {
  const snapshot = row?.paqueteria_pricing_snapshot;
  if (!snapshot?.fine_every_days || !row?.pickup_fee_started_at || row?.anulado || row?.delivered || row?.estado_pedido === "Entregado") return 0;
  const days = moment.tz(now, tz).startOf("day").diff(moment.tz(row.pickup_fee_started_at, tz).startOf("day"), "days");
  return money(Math.floor(Math.max(0, days) / Number(snapshot.fine_every_days)) * Number(snapshot.fine_amount || 0));
};
const present = (row: any) => {
  const fine = calculateFine(row);
  return { ...row, multa_actual: fine, total_a_cobrar: money(Number(row.deuda_comprador || 0) + fine) };
};
const normalizePayment = (value: unknown) => (["si", "no", "mixto"].includes(String(value)) ? String(value) : "no") as "si" | "no" | "mixto";

export const listMyCourierOrders = async (req: Request, res: Response) => {
  const id = courierId(res);
  const query: any = { paqueteria: id };
  if (req.query.status) query.estado_pedido = String(req.query.status);
  const rows = await VentaExternaModel.find(query).sort({ fecha_pedido: -1 }).lean();
  return res.json({ success: true, data: rows.map(present) });
};

export const createMyCourierOrders = async (req: Request, res: Response) => {
  try {
    const courier = await getCourier(res);
    if (!courier) return res.status(403).json({ success: false, msg: "Paqueteria no habilitada" });
    const packages = Array.isArray(req.body?.paquetes) ? req.body.paquetes : [req.body];
    if (!packages.length) return res.status(400).json({ success: false, msg: "Debe registrar al menos un paquete" });
    const created: any[] = [];
    for (let index = 0; index < packages.length; index += 1) {
      const input = packages[index] || {};
      const buyer = String(input.comprador || "").trim();
      const phone = String(input.telefono_comprador || "").trim();
      const description = String(input.descripcion_paquete || "").trim();
      if ((!buyer && !phone) || !description) throw new Error("Cada paquete requiere comprador o celular y descripcion");
      const paid = normalizePayment(input.esta_pagado);
      const fixed = money(courier.tarifa_fija);
      const sellerAmount = paid === "si" ? fixed : paid === "mixto" ? money(input.monto_paga_vendedor) : 0;
      if (paid === "mixto" && (sellerAmount <= 0 || sellerAmount >= fixed)) throw new Error("El pago mixto debe dividir la tarifa");
      const buyerAmount = money(fixed - sellerAmount);
      const row: any = new VentaExternaModel({
        paqueteria: courier._id, paqueteria_codigo_guia: courier.codigo_guia,
        paqueteria_pricing_snapshot: { fixed_price: fixed, fine_every_days: courier.multa_cada_dias, fine_amount: courier.monto_multa },
        carnet_vendedor: `PAQ-${courier.codigo_guia}`, vendedor: courier.nombre, telefono_vendedor: "",
        numero_paquete: index + 1, comprador: buyer, telefono_comprador: phone, descripcion_paquete: description,
        fecha_pedido: new Date(), service_origin: "external", precio_paquete: fixed, precio_paquete_unitario: fixed,
        precio_entre_sucursal: 0, precio_total: fixed, cargo_delivery: 0, costo_delivery: 0,
        esta_pagado: paid, monto_paga_vendedor: sellerAmount, monto_paga_comprador: buyerAmount,
        deuda_comprador: buyerAmount, saldo_cobrar: buyerAmount, estado_pedido: "En Espera", delivered: false, is_external: true,
        origen_sucursal: Types.ObjectId.isValid(input.origen_sucursal_id) ? input.origen_sucursal_id : undefined,
        destino_sucursal: Types.ObjectId.isValid(input.destino_sucursal_id) ? input.destino_sucursal_id : undefined,
      });
      await OrderGuideService.assignOrderGuide(row);
      await row.save(); created.push(row.toObject());
    }
    return res.status(201).json({ success: true, data: created.map(present) });
  } catch (error: any) { return res.status(400).json({ success: false, msg: error?.message || "No se pudo registrar el paquete" }); }
};

export const updateMyCourierOrder = async (req: Request, res: Response) => {
  const row: any = await VentaExternaModel.findOne({ _id: req.params.id, paqueteria: courierId(res), estado_pedido: "En Espera", anulado: { $ne: true } });
  if (!row) return res.status(404).json({ success: false, msg: "Pedido no editable" });
  const allowed = ["comprador", "telefono_comprador", "descripcion_paquete"];
  allowed.forEach((key) => { if (req.body?.[key] !== undefined) row[key] = String(req.body[key] || "").trim(); });
  await row.save(); return res.json({ success: true, data: present(row.toObject()) });
};

export const annulMyCourierOrder = async (req: Request, res: Response) => {
  const row: any = await VentaExternaModel.findOneAndUpdate(
    { _id: req.params.id, paqueteria: courierId(res), estado_pedido: "En Espera", anulado: { $ne: true } },
    { $set: { anulado: true, anulado_en: new Date(), anulado_por: String(res.locals.auth?.email || "paqueteria"), motivo_anulacion: String(req.body?.reason || "Anulado por paqueteria") } }, { new: true }
  ).lean();
  if (!row) return res.status(404).json({ success: false, msg: "Pedido no anulable" });
  return res.json({ success: true, data: present(row) });
};
