import { Request, Response } from "express";
import { SellerService } from "../services/seller.service";

export const getSellers = async (req: Request, res: Response) => {
  const sellers = await SellerService.getAllSellers();
  res.json(sellers);
};

export const getSeller = async (req: Request, res: Response) => {
  try {
    const sellerId = req.params.id;
    const seller = await SellerService.getSeller(sellerId);
    if (seller) {
      res.json(seller);
    } else {
      res.status(404).json({ msg: `Seller not found with such id ${sellerId}` });      
    }
  } catch (error) {
    res.status(500).json({ msg: "Error getting seller", error });
  }
};

export const registerSeller = async (req: Request, res: Response) => {
  const seller = req.body;
  try {
    const newSeller = await SellerService.registerSeller(seller);
    res.json({
      status: true,
      newSeller,
    });
  } catch (error) {
    res.status(500).json({ msg: "Internal server error", error });
  }
};

export const updateSeller = async (req: Request, res: Response) => {
  const sellerId = parseInt(req.params.id);
  const { newData } = req.body;
  try {
    const updatedSeller = await SellerService.updateSeller(sellerId, newData);
    res.json({ status: true, updatedSeller });
  } catch (error) {
    res.status(500).json({ msg: "Internal server error", error });
  }
};
