import { Request, Response } from "express";
import { TermsDocumentService } from "../services/termsDocument.service";

export const getTermsDocumentController = (_req: Request, res: Response) =>
  res.json({ success: true, data: TermsDocumentService.get() });

export const replaceTermsDocumentController = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Debes seleccionar un archivo PDF" });
  try {
    const data = await TermsDocumentService.replace(req.file);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("[terms-document] replace:error", error);
    return res.status(500).json({ success: false, message: error?.message || "No se pudo actualizar el documento" });
  }
};
