import { Request, Response } from "express";
import { ShippingService } from "../services/shipping.service";

export const getShipping = async (req: Request, res: Response) => {
  try {
    const shippings = await ShippingService.getAllShippings();
    res.json(shippings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getShippingByIds = async (req: Request, res: Response) => {
  const { ids } = req.params;
  try {
    const idsArray = ids.split(",").map((id) => (id.trim()));
    const shippings = await ShippingService.getShippingByIds(idsArray);
    res.json(shippings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting shippings by Ids" });
  }
};
export const registerShipping = async (req: Request, res: Response) => {
  const shipping = req.body;
  try {
    const newShipping = await ShippingService.registerShipping(shipping);
    res.json({
      status: true,
      newShipping,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const registerSaleToShipping = async (req: Request, res: Response) => {
  const { shippingId, sales } = req.body;

  try {
    const result = await ShippingService.processSalesForShipping(shippingId, sales);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Shipping Internal Server Error", error });
  }
};

export const getShippingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const shipping = await ShippingService.getShippingById(id);
    if (!shipping) return res.status(404).json({ success: false, msg: "Pedido no encontrado" });
    res.json(shipping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: "Error interno" });
  }
};


const updateShipping = async (req: Request, res: Response) => {
  const id = req.params.id;
  const newData = req.body;

  try {
    const shippingUpdated = await ShippingService.updateShipping(newData, id);
    res.json({ success: true, shippingUpdated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: "Internal Server Error", error });
  }
};
export const addTemporaryProductsToShipping = async (req: Request, res: Response) => {
  const id = req.params.id;
  const { productos_temporales } = req.body;

  if (!Array.isArray(productos_temporales)) {
    return res.status(400).json({
      success: false,
      msg: "productos_temporales debe ser un array válido",
    });
  }

  try {
    await ShippingService.addTemporaryProductsToShipping(id, productos_temporales);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: "Internal Server Error", error });
  }
};

export const getShippingsBySellerController = async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;
  try {
    const shippingsBySeller = await ShippingService.getShippingsBySellerService(
      id
    );
    res.json(shippingsBySeller);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
export const deleteShippingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await ShippingService.deleteShippingById(id);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al eliminar el pedido:", error);
    res.status(500).json({ success: false, msg: "No se pudo eliminar el pedido" });
  }
};

export const getSalesHistory = async (req: Request, res: Response) => {
  const { date, sucursalId } = req.query;
  try {
    const result = await ShippingService.getDailySalesHistory(date as string | undefined, sucursalId as string);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener historial de ventas:", error);
    res.status(500).json({ success: false, msg: "Error interno" });
  }
};
export const generateQRForShipping = async (req: Request, res: Response) => {
  const { id } = req.params;
  const forceRegenerate = req.query.forceRegenerate === "true";

  try {
    const qrData = await ShippingService.generateShippingQR(id, forceRegenerate);
    res.json({
      success: true,
      qrData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar el QR" });
  }
};

export const getShippingByQR = async (req: Request, res: Response) => {
  const { id: codeOrId } = req.params;

  try {
    const shipping = await ShippingService.getShippingDetailsForQR(codeOrId);
    if (!shipping) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(shipping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener información del pedido" });
  }
};

export const resolveShippingByQRPayload = async (req: Request, res: Response) => {
  const payload = req.query.payload as string | undefined;

  if (!payload) {
    return res.status(400).json({
      success: false,
      message: "payload es requerido"
    });
  }

  try {
    const shipping = await ShippingService.resolveShippingByQRPayload(payload);
    if (!shipping) {
      return res.status(404).json({
        success: false,
        message: "No se encontró pedido para ese QR"
      });
    }

    res.json({
      success: true,
      shipping
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error al resolver QR de envío",
      error
    });
  }
};

export const transitionShippingStatusByQRController = async (req: Request, res: Response) => {
  const { payload, shippingCode, shippingId, toStatus, changedBy, note } = req.body || {};

  if (!toStatus) {
    return res.status(400).json({
      success: false,
      message: "toStatus es requerido"
    });
  }

  try {
    const result = await ShippingService.transitionShippingStatusByQR({
      payload,
      shippingCode,
      shippingId,
      toStatus,
      changedBy,
      note
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado por QR",
      error
    });
  }
};

export const getShippingStatusHistoryController = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const history = await ShippingService.getShippingStatusHistory(id);
    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error al obtener historial de estados",
      error
    });
  }
};

export const ShippingController = {
  updateShipping,
  getShippingById,
  getSalesHistory
};
