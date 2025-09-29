import { Request, Response } from "express";
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
        const { id } = req.params;
        const shippingGuides = await ShippingGuideService.getBranchShippings(id);
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const uploadShipping = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se recibió ninguna imagen" });
        }
        const imagen_s3_key = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype);
        const shippingGuide: IGuiaEnvio = {
            vendedor: req.body.vendedor,
            sucursal: req.body.sucursal,
            descripcion: req.body.descripcion,
            fecha_subida: new Date(),
            imagen_key: imagen_s3_key,
        };
        const newShippingGuide = await ShippingGuideService.uploadShipping(shippingGuide);
        res.json({
            status: true,
            newShippingGuide,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
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