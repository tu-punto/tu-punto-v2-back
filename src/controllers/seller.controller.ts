import { Request, Response } from "express";
import { SellerService } from "../services/seller.service";

export const getSellers = async (_: Request, res: Response) => {
  try {
    const sellerList = await SellerService.getAllSellers();
    res.json(sellerList);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo vendedores", err });
  }
};

export const getSeller = async (req: Request, res: Response) => {
  try {
    const sellerIdParam = req.params.id;
    const seller = await SellerService.getSeller(sellerIdParam);

    if (!seller) {
      return res
        .status(404)
        .json({ msg: `No existe vendedor con id ${sellerIdParam}` });
    }
    res.json(seller);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo vendedor", err });
  }
};

export const registerSeller = async (req: Request, res: Response) => {
  try {
    const sellerPayload = req.body;
    const createdSeller = await SellerService.registerSeller(sellerPayload);
    res.json({ ok: true, createdSeller });
  } catch (err) {
    res.status(500).json({ msg: "Error registrando vendedor", err });
  }
};

export const updateSeller = async (req: Request, res: Response) => {
  try {
    const sellerId = req.params.id;
    const updatePayload = req.body;

    const updatedSeller = await SellerService.updateSeller(
      sellerId,
      updatePayload.newData
    );
    res.json({ ok: true, updatedSeller });
  } catch (err) {
    res.status(500).json({ msg: "Error actualizando vendedor", err });
  }
};
