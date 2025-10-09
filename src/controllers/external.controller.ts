import { Request, Response } from "express";
import { ExternalSaleService } from "../services/external.service";

export const getAllExternalSales = async (req: Request, res: Response) => {
    try {
        const externalSales = await ExternalSaleService.getAllExternalSales();
        res.json(externalSales);
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
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Internal Server Error"});
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
    } catch (error) {
        console.error("Error al actualizar la venta externa:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error al actualizar la venta externa" 
        });
    }
}