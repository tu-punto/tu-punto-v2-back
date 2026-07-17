import { Request, Response } from "express";
import { Types } from "mongoose";
import { ShippingGuideService } from "../services/shippingGuide.service";
import { IGuiaEnvio } from "../entities/IGuiaEnvio";
import { uploadFileToS3 } from "../helpers/S3Client";

export const getAllShippings = async (req: Request, res: Response) => {
    try {
        const shippingGuides = await ShippingGuideService.getAllShippings();
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getSellerShippings = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const shippingGuides = await ShippingGuideService.getSellerShippings(id);
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getBranchShippings = async (req: Request, res: Response) => {
    try {
        const auth = res.locals.auth as { sucursalId?: string } | undefined;
        const branchId = String(auth?.sucursalId || req.params.id || "").trim();
        const shippingGuides = await ShippingGuideService.getBranchShippings(branchId);
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const uploadShipping = async (req: Request, res: Response) => {
    try {
        const auth = res.locals.auth as { role?: string; sellerId?: string } | undefined;
        const vendedorId = String(req.body.vendedor || auth?.sellerId || "").trim();
        const sucursalId = String(req.body.sucursal || "").trim();

        if (!Types.ObjectId.isValid(vendedorId)) {
            return res.status(400).json({ success: false, message: "No se pudo identificar el vendedor" });
        }
        if (!Types.ObjectId.isValid(sucursalId)) {
            return res.status(400).json({ success: false, message: "Debe seleccionar una sucursal valida" });
        }
        if (String(auth?.role || "").toLowerCase() === "seller" && auth?.sellerId && String(auth.sellerId) !== vendedorId) {
            return res.status(403).json({ success: false, message: "No autorizado para este vendedor" });
        }

        let shippingGuide: IGuiaEnvio = {
            vendedor: new Types.ObjectId(vendedorId),
            sucursal: new Types.ObjectId(sucursalId),
            descripcion: req.body.descripcion,
            fecha_subida: new Date(),
        }
        if (req.file) {
            const imagen_s3_key = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype);
            shippingGuide = {
                ...shippingGuide, 
                imagen_key: imagen_s3_key
            }
        }
        const newShippingGuide = await ShippingGuideService.uploadShipping(shippingGuide);
        res.json({
            success: true,
            status: true,
            newShippingGuide,
        });
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Error registrando la guia";
        res.status(500).json({ success: false, message });
    }
}

export const markAsDelivered = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updatedShipping = await ShippingGuideService.markAsDelivered(id);
        res.json({
            status: true,
            updatedShipping
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" })
    }
}
