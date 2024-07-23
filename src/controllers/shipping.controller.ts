import { Request, Response } from "express";
import { ShippingService } from "../services/shipping.service";

export const getShipping = async (req: Request, res:Response) =>{
    try {
        const shippings = await ShippingService.getAllShippings();
        res.json(shippings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const registerShipping = async (req: Request, res:Response) =>{
    const shipping = req.body;
    try{
        const newShipping = await ShippingService.registerShipping(shipping)
        res.json({
            status: true,
            newShipping
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}