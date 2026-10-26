import { Request, Response } from "express";
import { Types } from "mongoose";
import { FarmerDiscountRuleModel } from "../entities/implements/FarmerDiscountRuleSchema";

const normalize = (body: any) => ({
  limite_inferior: Number(body?.limite_inferior),
  limite_superior: Number(body?.limite_superior),
  monto_descontado: Number(body?.monto_descontado),
  monto_para_tu_punto: Number(body?.monto_para_tu_punto),
});

const validateRule = async (rule: ReturnType<typeof normalize>, excludeId?: string) => {
  if (Object.values(rule).some((value) => !Number.isFinite(value) || value < 0) || rule.limite_inferior > rule.limite_superior) {
    throw new Error("Los límites y montos de la regla son inválidos");
  }
  if (rule.monto_para_tu_punto > rule.monto_descontado) throw new Error("Monto para Tu Punto no puede superar el monto descontado");
  const overlap = await FarmerDiscountRuleModel.exists({
    ...(excludeId && Types.ObjectId.isValid(excludeId) ? { _id: { $ne: excludeId } } : {}),
    limite_inferior: { $lte: rule.limite_superior },
    limite_superior: { $gte: rule.limite_inferior },
  });
  if (overlap) throw new Error("El rango se superpone con una regla existente");
};

export const listFarmerDiscountRules = async (_req: Request, res: Response) =>
  res.json({ success: true, data: await FarmerDiscountRuleModel.find().sort({ limite_inferior: 1 }).lean() });

export const listFarmerBonusRules = async (_req: Request, res: Response) => {
  try {
    const rules = await FarmerDiscountRuleModel.find().sort({ limite_inferior: 1 }).lean();
    return res.json({
      success: true,
      data: rules.map((rule) => ({
        limite_inferior: rule.limite_inferior,
        limite_superior: rule.limite_superior,
        bono_granjero: Number(rule.monto_descontado || 0) - Number(rule.monto_para_tu_punto || 0),
      })),
    });
  } catch (error) {
    console.error("Error al consultar bonos de granjero:", error);
    return res.status(500).json({ success: false, msg: "No se pudieron consultar los bonos" });
  }
};

export const createFarmerDiscountRule = async (req: Request, res: Response) => {
  try { const rule = normalize(req.body); await validateRule(rule); res.status(201).json({ success: true, data: await FarmerDiscountRuleModel.create(rule) }); }
  catch (error: any) { res.status(400).json({ success: false, msg: error.message || "No se pudo crear la regla" }); }
};

export const updateFarmerDiscountRule = async (req: Request, res: Response) => {
  try { const rule = normalize(req.body); await validateRule(rule, req.params.id); const data = await FarmerDiscountRuleModel.findByIdAndUpdate(req.params.id, rule, { new: true }); if (!data) return res.status(404).json({ success: false, msg: "Regla no encontrada" }); res.json({ success: true, data }); }
  catch (error: any) { res.status(400).json({ success: false, msg: error.message || "No se pudo actualizar la regla" }); }
};

export const deleteFarmerDiscountRule = async (req: Request, res: Response) => {
  const data = await FarmerDiscountRuleModel.findByIdAndDelete(req.params.id);
  if (!data) return res.status(404).json({ success: false, msg: "Regla no encontrada" });
  return res.json({ success: true });
};
