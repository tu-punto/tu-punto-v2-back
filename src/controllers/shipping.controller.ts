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
    const savedSales = [];

    for (let sale of sales) {
      const saleShipping = await ShippingService.registerSaleToShipping(
        shippingId,
        sale
      );
      savedSales.push(saleShipping);
    }
    res.json(savedSales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Shipping Internal Server Error", error });
  }
};

const updateShipping = async (req: Request, res: Response) => {
  const id = (req.params.id);
  const { newData } = req.body;
  try {
    const shippingUpdated = await ShippingService.updateShipping(newData, id);
    res.json(shippingUpdated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};

export const getShippingsBySellerController = async (
  req: Request,
  res: Response
) => {
  const id = parseInt(req.params.id);
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

export const ShippingController = {
  updateShipping,
};
