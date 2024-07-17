import { Request, Response } from "express";
import { FeatureService } from "../services/feature.service";

export const getFeature = async (req: Request, res:Response) =>{
    try {
        const features = await FeatureService.getAllFeatures();
        res.json(features);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const registerFeature = async (req: Request, res:Response) =>{
    const feature = req.body;
    try{
        const newfeature = await FeatureService.registerFeature(feature)
        res.json({
            status: true,
            newfeature
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}