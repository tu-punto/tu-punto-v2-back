import { Router } from "express";
import crypto from "crypto";
import { ExternalIntegrationModel } from "../entities/implements/ExternalIntegrationSchema";
import { ExternalIntegrationDeliveryModel } from "../entities/implements/ExternalIntegrationSchema";
import { ShippingService } from "../services/shipping.service";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
export const externalDeliveryRouter = Router();
externalDeliveryRouter.post("/deliveries", async (req, res) => {
  const key = String(req.header("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const integration: any = key ? await ExternalIntegrationModel.findOne({ keyHash: hash(key), active: true }).lean() : null;
  if (!integration) return res.status(401).json({ success:false, message:"Clave de integracion invalida" });
  const externalOrderId = String(req.body?.externalOrderId || "").trim(); const type = String(req.body?.type || "").trim();
  if (!externalOrderId || !["stock", "simple"].includes(type)) return res.status(400).json({success:false,message:"externalOrderId y type son obligatorios"});
  const fingerprint = hash(JSON.stringify(req.body));
  const previous: any = await ExternalIntegrationDeliveryModel.findOne({ integrationId: integration._id, externalOrderId }).lean();
  if (previous) return previous.fingerprint === fingerprint ? res.json({success:true, duplicate:true, shippingId:previous.shippingId, packageId:previous.packageId}) : res.status(409).json({success:false,message:"externalOrderId ya fue usado con datos distintos"});
  try {
    if (type !== "stock") throw new Error("Las entregas simples requieren configuracion de sucursales; este conector se habilitara al registrar la ruta del vendedor");
    const customer = req.body?.customer || {}; const delivery = req.body?.delivery || {};
    if (!String(customer.name || "").trim() || !String(customer.phone || "").trim() || !String(delivery.destination || "").trim()) throw new Error("customer.name, customer.phone y delivery.destination son obligatorios");
    const shipping: any = await ShippingService.registerShipping({ cliente:customer.name, telefono_cliente:customer.phone, lugar_entrega:delivery.destination, observaciones:`Integracion externa: ${externalOrderId}`, estado_pedido:"En Espera", tipo_destino:"otro_lugar", costo_delivery:0, cargo_delivery:0, esta_pagado:"no", origen_pedido:"interno" });
    await ExternalIntegrationDeliveryModel.create({integrationId:integration._id,externalOrderId,fingerprint,type,shippingId:shipping._id,status:"success"});
    await ExternalIntegrationModel.updateOne({_id:integration._id},{$set:{lastUsedAt:new Date()}});
    return res.status(201).json({success:true,shippingId:shipping._id,status:shipping.estado_pedido});
  } catch(error:any) { return res.status(400).json({success:false,message:error?.message || "No se pudo crear la entrega"}); }
});
router.use(requireAuth, requireRole("seller"));
router.get("/", async (_req, res) => res.json({ success: true, rows: await ExternalIntegrationModel.find({ sellerId: res.locals.auth.sellerId }).select("name keyPrefix active lastUsedAt createdAt").lean() }));
router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim(); if (!name) return res.status(400).json({ success:false, message:"El nombre es obligatorio" });
  const key = `tp_live_${crypto.randomBytes(24).toString("base64url")}`;
  const row = await ExternalIntegrationModel.create({ sellerId: res.locals.auth.sellerId, name, keyHash: hash(key), keyPrefix: key.slice(0, 12) });
  res.status(201).json({ success:true, integration:{ _id:row._id, name:row.name, active:row.active, keyPrefix:row.keyPrefix }, key });
});
router.patch("/:id", async (req,res) => { const row = await ExternalIntegrationModel.findOneAndUpdate({ _id:req.params.id, sellerId:res.locals.auth.sellerId }, { $set:{ active:req.body?.active === true } }, {new:true}); if(!row) return res.status(404).json({success:false,message:"Integracion no encontrada"}); res.json({success:true,row}); });
export default router;
