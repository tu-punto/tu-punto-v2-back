import { Request, Response } from "express";
import { LandingLeadService } from "../services/landingLead.service";

export const createLandingLeadController = async (req: Request, res: Response) => {
  try {
    const lead = await LandingLeadService.registerLead(req.body || {});
    res.status(201).json({
      success: true,
      message: "Tu informacion fue registrada correctamente",
      lead,
    });
  } catch (error: any) {
    console.error("[landing-leads] error creando lead:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo registrar la informacion",
    });
  }
};

export const listLandingLeadsController = async (_req: Request, res: Response) => {
  try {
    const leads = await LandingLeadService.listLeads();
    const newCount = leads.filter((lead: any) => lead?.contactado !== true).length;
    res.json({
      success: true,
      leads,
      newCount,
    });
  } catch (error: any) {
    console.error("[landing-leads] error listando leads:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "No se pudieron obtener los leads",
    });
  }
};

export const updateLandingLeadContactStatusController = async (req: Request, res: Response) => {
  try {
    const lead = await LandingLeadService.updateContactStatus(
      String(req.params.id || ""),
      req.body?.contactado === true
    );

    res.json({
      success: true,
      lead,
    });
  } catch (error: any) {
    console.error("[landing-leads] error actualizando lead:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "No se pudo actualizar el lead",
    });
  }
};
