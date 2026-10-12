import { Types } from "mongoose";
import { AdelantoTuPuntoModel } from "../entities/implements/AdelantoTuPuntoSchema";

const objectIdOrUndefined = (value: unknown) => {
  const id = String((value as any)?._id || value || "").trim();
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
};

const syncForShipping = async (shipping: any, options?: { reverted?: boolean; reason?: string }) => {
  const orderId = objectIdOrUndefined(shipping?._id);
  if (!orderId) return;

  if (options?.reverted) {
    await AdelantoTuPuntoModel.findOneAndUpdate(
      { pedido: orderId, estado: "activo" },
      { $set: { estado: "revertido", revertido_en: new Date(), motivo_reversion: options.reason || "Pedido cancelado o adelanto retirado" } }
    );
    return;
  }

  if (String(shipping?.esta_pagado || "") !== "adelanto_tu_punto") return;
  const monto = Number(shipping?.adelanto_cliente || 0);
  const efectivo = Number(shipping?.adelanto_tu_punto_efectivo || 0);
  const qr = Number(shipping?.adelanto_tu_punto_qr || 0);
  if (monto <= 0 || Math.abs(efectivo + qr - monto) > 0.01) return;

  await AdelantoTuPuntoModel.findOneAndUpdate(
    { pedido: orderId },
    {
      $set: {
        sucursal: objectIdOrUndefined(shipping?.sucursal || shipping?.lugar_origen),
        registrado_por: objectIdOrUndefined(shipping?.adelanto_tu_punto_registrado_por),
        monto,
        efectivo,
        qr,
        estado: "activo",
        revertido_en: undefined,
        motivo_reversion: undefined,
      },
      $setOnInsert: { pedido: orderId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const assignToBoxClose = async (boxClose: any) => {
  const closeId = objectIdOrUndefined(boxClose?._id);
  const branchId = objectIdOrUndefined(boxClose?.id_sucursal);
  const closedAt = boxClose?.closed_at || boxClose?.created_at || new Date();
  if (!closeId || !branchId) return;

  await AdelantoTuPuntoModel.updateMany(
    { sucursal: branchId, estado: "activo", cierre_caja: { $exists: false }, created_at: { $lte: new Date(closedAt) } },
    { $set: { cierre_caja: closeId } }
  );
};

export const AdelantoTuPuntoService = { syncForShipping, assignToBoxClose };
