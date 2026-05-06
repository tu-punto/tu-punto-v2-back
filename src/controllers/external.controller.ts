import { Request, Response } from "express";
import { ExternalSaleService } from "../services/external.service";
import { OrderGuideWhatsappService } from "../services/orderGuideWhatsapp.service";

export const getAllExternalSales = async (req: Request, res: Response) => {
    try {
        const externalSales = await ExternalSaleService.getAllExternalSales();
        res.json(externalSales);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getExternalSalesList = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 50);
        const status = (req.query.status as string | undefined) || undefined;
        const sucursalId = (req.query.sucursalId as string | undefined) || undefined;
        const client = (req.query.client as string | undefined) || undefined;
        const fromRaw = (req.query.from as string | undefined) || undefined;
        const toRaw = (req.query.to as string | undefined) || undefined;

        const from = fromRaw ? new Date(fromRaw) : undefined;
        const to = toRaw ? new Date(toRaw) : undefined;

        const result = await ExternalSaleService.getExternalSalesList({
            page,
            limit,
            status,
            from,
            to,
            sucursalId,
            client
        });
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getExternalContactSuggestions = async (req: Request, res: Response) => {
    try {
        const query = (req.query.query as string | undefined) || "";
        const field = (req.query.field as "seller_carnet" | "name" | "phone" | undefined) || "name";
        const limit = Number(req.query.limit || 8);

        const suggestions = await ExternalSaleService.getExternalContactSuggestions({
            query,
            field,
            limit
        });

        res.json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
}

export const getExternalSaleByID = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const externalSale = await ExternalSaleService.getExternalSaleByID(id);
        if (!externalSale) {
            return res.status(404).json({
                success: false,
                message: "Venta externa no encontrada"
            });
        }

        res.json(externalSale);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const registerExternalSale = async (req: Request, res: Response) => {
    const externalSale = req.body;
    try {
        const newExternalSale = await ExternalSaleService.registerExternalSale(externalSale);
        res.json({
            status: true,
            newExternalSale,
        });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({
            success: false,
            message: error?.message || "No se pudo registrar la venta externa"
        });
    }
}

export const registerExternalSalesByPackages = async (req: Request, res: Response) => {
    try {
        const createdSales = await ExternalSaleService.registerExternalSalesByPackages(req.body);
        res.json({
            success: true,
            createdCount: createdSales.length,
            data: createdSales
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error?.message || "Internal Server Error"
        });
    }
}

export const deleteExternalSaleByID = async (req: Request, res: Response) => {
    const {id} =  req.params;
    try {
        await ExternalSaleService.deleteExternalSaleByID(id);
        res.json({
            success: true,
            message: "Venta externa eliminada exitosamente"
        });
    } catch (error) {
    console.error("Error al eliminar la venta externa:", error);
    res.status(500).json({ success: false, msg: "No se pudo eliminar la venta externa" });
  }
}

export const updateExternalSaleByID = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    
    try {
        const updatedSale = await ExternalSaleService.updateExternalSaleByID(id, updateData);
        
        if (!updatedSale) {
            return res.status(404).json({
                success: false,
                message: "Venta externa no encontrada"
            });
        }

        res.json({
            success: true,
            message: "Venta externa actualizada exitosamente",
            data: updatedSale
        });
    } catch (error: any) {
        console.error("Error al actualizar la venta externa:", error);
        res.status(400).json({ 
            success: false, 
            message: error?.message || "Error al actualizar la venta externa" 
        });
    }
}

export const sendExternalGuideWhatsapp = async (req: Request, res: Response) => {
    try {
        const result = await OrderGuideWhatsappService.sendExternalGuideMessages(req.params.id);
        return res.json({
            ...result
        });
    } catch (error: any) {
        console.error("Error enviando WhatsApp de guia externa:", error);
        return res.status(400).json({
            success: false,
            message: error?.message || "No se pudo enviar el WhatsApp de la guia"
        });
    }
}
