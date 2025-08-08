import { Request, Response } from "express";
import { ShippingGuideService } from "../services/shippingGuide.service";

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
        const {id_vendedor} = req.body
        const shippingGuides = await ShippingGuideService.getSellerShippings(id_vendedor);
        res.json(shippingGuides);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const uploadShipping = async (req: Request, res: Response) => {
    const shippingGuide = req.body
    try {
        const newShippingGuide = await ShippingGuideService.uploadShipping(shippingGuide);
        res.json({
            status: true,
            newShippingGuide
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

