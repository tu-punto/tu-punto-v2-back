import { Request, Response } from "express";
import { DynamicQRService, getDynamicQRPublicUrl } from "../services/dynamicQR.service";

const serialize = (item: any) => ({ ...item, id: String(item._id), publicUrl: getDynamicQRPublicUrl(item.code) });
const failure = (res: Response, error: any, status = 400) => res.status(status).json({ success: false, message: error?.message || "Error procesando QR" });

export const DynamicQRController = {
  async list(req: Request, res: Response) {
    try { const result = await DynamicQRService.list(req.query); return res.json({ success: true, ...result, rows: result.rows.map(serialize) }); }
    catch (error) { return failure(res, error, 500); }
  },
  async create(req: Request, res: Response) {
    try { const item = await DynamicQRService.create({ ...req.body, createdBy: String(res.locals.auth?.id || "") }); return res.status(201).json({ success: true, qr: serialize(item.toObject()) }); }
    catch (error) { return failure(res, error); }
  },
  async update(req: Request, res: Response) {
    try { const item = await DynamicQRService.update(req.params.id, req.body); return res.json({ success: true, qr: serialize(item) }); }
    catch (error) { return failure(res, error); }
  },
  async image(req: Request, res: Response) {
    try {
      const item = await DynamicQRService.findByCode(String(req.params.code));
      if (!item) return res.status(404).json({ success: false, message: "QR no encontrado" });
      const png = await DynamicQRService.png(item.code);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="tu-punto-qr-${item.code}.png"`);
      return res.send(png);
    } catch (error) { return failure(res, error, 500); }
  },
  async publicResolve(req: Request, res: Response) {
    try {
      const item = await DynamicQRService.resolve(String(req.params.code));
      if (!item) return res.status(404).json({ success: false, message: "Enlace no disponible" });
      return res.json({ success: true, destinationUrl: item.destinationUrl });
    } catch (error) { return failure(res, error, 500); }
  },
};
