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
    const id = req.params.id;
    const updated = await SellerService.updateSeller(id, req.body);   // sin flux
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ msg: "Error actualizando vendedor", err });
  }
};

export const renewSeller = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const renewed = await SellerService.renewSeller(id, req.body);    // con flux
    res.json({ ok: true, renewed });
  } catch (err) {
    res.status(500).json({ msg: "Error renovando vendedor", err });
  }
};

export const paySellerDebt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payAll } = req.body;

    const updated = await SellerService.paySellerDebt(id, payAll);

    if (!updated) {
      return res.status(404).json({ msg: `No existe vendedor con id ${id}` });
    }
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ msg: 'Error pagando deuda', err });
  }
};