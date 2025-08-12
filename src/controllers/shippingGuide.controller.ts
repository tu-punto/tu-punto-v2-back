import { Request, Response } from "express";
import { ShippingGuideService } from "../services/shippingGuide.service";
import { IGuiaEnvio } from "../entities/IGuiaEnvio";

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
        const {id} = req.params
        const shippingGuides = await ShippingGuideService.getSellerShippings(id);
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getBranchShippings = async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        const shippingGuides = await ShippingGuideService.getBranchShippings(id);
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error"});
    }
}

export const uploadShipping = async (req: Request, res: Response) => {
    const shippingGuide: IGuiaEnvio = {
        vendedor: req.body.vendedor,
        sucursal: req.body.sucursal,
        descripcion: req.body.descripcion,
        fecha_subida: new Date(),
        tipoArchivo: req.file?.mimetype as "image/jpeg" | "image/png" | "image/webp",
        imagen: req.file?.buffer
    };
    try {
        const newShippingGuide = await ShippingGuideService.uploadShipping(shippingGuide);
        res.json({
            status: true,
            newShippingGuide
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
        res.status(500).json({ error: "Internal Server Error"})
    }
}