import { Request, Response } from "express";
import { ShippingService } from "../services/shipping.service";
import QRCode from 'qrcode';

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

  try {
    const shipping = await ShippingService.getShippingById(id);
    if (!shipping) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Generar URL para el QR (ajusta según tu dominio)
    const qrUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/shipping/qr/${id}`;

    // Generar el código QR
    const qrCode = await QRCode.toDataURL(qrUrl);

    // Guardar el código QR en el pedido
    await ShippingService.saveQRCode(id, qrCode);

    res.json({
      success: true,
      qrCode: qrCode,
      shippingId: id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al generar el QR" });
  }
};

export const getShippingByQR = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const shipping = await ShippingService.getShippingDetailsForQR(id);
    if (!shipping) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(shipping);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener información del pedido" });
  }
};

export const ShippingController = {
  updateShipping,
  getShippingById,
  getSalesHistory
};
