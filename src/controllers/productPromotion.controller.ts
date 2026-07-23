import { Request, Response } from "express";
import { ProductPromotionService } from "../services/productPromotion.service";

const getAuthSellerId = (res: Response) => String(res.locals.auth?.sellerId || "").trim();

export const listPromotions = async (req: Request, res: Response) => {
  try {
    const sellerId = getAuthSellerId(res);
    if (!sellerId) {
      return res.status(400).json({ success: false, message: "sellerId no resuelto" });
    }

    const result = await ProductPromotionService.listPromotions({
      sellerId,
      q: String(req.query.q || "").trim() || undefined,
      scope: (String(req.query.scope || "").trim() || "all") as any,
      state: String(req.query.state || "").trim() || undefined,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12)
    });
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error listando promociones:", error);
    return res.status(500).json({ success: false, message: error?.message || "Error al listar promociones" });
  }
};

export const listVariantOptions = async (req: Request, res: Response) => {
  try {
    const sellerId = getAuthSellerId(res);
    if (!sellerId) {
      return res.status(400).json({ success: false, message: "sellerId no resuelto" });
    }
    const rows = await ProductPromotionService.listSellerVariantOptions(
      sellerId,
      String(req.query.q || "").trim() || undefined
    );
    return res.json({ success: true, rows });
  } catch (error: any) {
    console.error("Error listando variantes para promociones:", error);
    return res.status(500).json({ success: false, message: error?.message || "Error al listar variantes" });
  }
};

export const createPromotion = async (req: Request, res: Response) => {
  try {
    const sellerId = getAuthSellerId(res);
    if (!sellerId) {
      return res.status(400).json({ success: false, message: "sellerId no resuelto" });
    }
    const promotion = await ProductPromotionService.createPromotion({
      sellerId,
      productId: String(req.body?.productId || "").trim(),
      variantKey: String(req.body?.variantKey || "").trim(),
      scope: String(req.body?.scope || "interno").trim() as any,
      title: req.body?.title,
      simplePrice: req.body?.simplePrice,
      tiers: Array.isArray(req.body?.tiers) ? req.body.tiers : [],
      startsAt: req.body?.startsAt,
      endsAt: req.body?.endsAt,
      state: String(req.body?.state || "active").trim() as any
    });
    return res.status(201).json({ success: true, promotion });
  } catch (error: any) {
    console.error("Error creando promocion:", error);
    return res.status(500).json({ success: false, message: error?.message || "Error al crear promocion" });
  }
};

export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const sellerId = getAuthSellerId(res);
    if (!sellerId) {
      return res.status(400).json({ success: false, message: "sellerId no resuelto" });
    }
    const promotion = await ProductPromotionService.updatePromotion(String(req.params.id || ""), sellerId, {
      productId: req.body?.productId,
      variantKey: req.body?.variantKey,
      scope: req.body?.scope,
      title: req.body?.title,
      simplePrice: req.body?.simplePrice,
      tiers: Array.isArray(req.body?.tiers) ? req.body.tiers : undefined,
      startsAt: req.body?.startsAt,
      endsAt: req.body?.endsAt,
      state: req.body?.state
    });
    return res.json({ success: true, promotion });
  } catch (error: any) {
    console.error("Error actualizando promocion:", error);
    return res.status(500).json({ success: false, message: error?.message || "Error al actualizar promocion" });
  }
};

export const deletePromotion = async (req: Request, res: Response) => {
  try {
    const sellerId = getAuthSellerId(res);
    if (!sellerId) {
      return res.status(400).json({ success: false, message: "sellerId no resuelto" });
    }
    const result = await ProductPromotionService.deletePromotion(String(req.params.id || ""), sellerId);
    return res.json({ success: true, result });
  } catch (error: any) {
    console.error("Error eliminando promocion:", error);
    return res.status(500).json({ success: false, message: error?.message || "Error al eliminar promocion" });
  }
};

export const previewPromotion = async (req: Request, res: Response) => {
  try {
    const sellerId = getAuthSellerId(res);
    if (!sellerId) {
      return res.status(400).json({ success: false, message: "sellerId no resuelto" });
    }
    const preview = await ProductPromotionService.previewPromotion({
      sellerId,
      productId: String(req.body?.productId || "").trim(),
      variantKey: String(req.body?.variantKey || "").trim(),
      scope: String(req.body?.scope || "interno").trim() as any,
      quantity: Number(req.body?.quantity || 1),
      simplePrice: req.body?.simplePrice,
      tiers: Array.isArray(req.body?.tiers) ? req.body.tiers : []
    });
    return res.json({ success: true, preview });
  } catch (error: any) {
    console.error("Error previsualizando promocion:", error);
    return res.status(500).json({ success: false, message: error?.message || "Error al previsualizar promocion" });
  }
};

export const ProductPromotionController = {
  listPromotions,
  listVariantOptions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  previewPromotion
};
