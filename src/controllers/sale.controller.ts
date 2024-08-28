import { Request, Response } from "express";
import { SaleService } from "../services/sale.service";

export const getSale = async (req: Request, res: Response) => {
  try {
    const sale = await SaleService.getAllSales();
    res.json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};

export const registerSale = async (req: Request, res: Response) => {
  const sale = req.body;
  try {
    const newSale = await SaleService.registerSale(sale);
    res.json({
      status: true,
      newSale,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
export const getProducts = async (req: Request, res: Response) => {
  const id: number = parseInt(req.params.id);
  try {
    const products = await SaleService.getProductsById(id);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
export const getProductsBySellerId = async (req: Request, res: Response) => {
  const sellerId: number = parseInt(req.params.id);
  try {
    const products = await SaleService.getProductsBySellerId(sellerId);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error getting products by seller id", error });
  }
};

export const updateProducts = async (req: Request, res: Response) => {
  const shippingId = parseInt(req.params.id);
  const prods = req.body;
  try {
    const updatedProds = await SaleService.updateProducts(shippingId, prods);
    res.json({
      status: true,
      updatedProds,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error updating products", error });
  }
};
export const updateSale = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { newData } = req.body;
  try {
    const saleUpdated = await SaleService.updateSalesByIds(newData, id);
    res.json(saleUpdated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};
export const deleteProducts = async (req: Request, res: Response) => {
  const shippingId = parseInt(req.params.id);
  const prods = req.body;
  try {
    const deleteProduct = await SaleService.deleteProducts(shippingId, prods);
    res.json({
      status: true,
      deleteProduct,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error deleting products", error });
  }
}
export const deleteSales = async (req: Request, res: Response) => {
    const {ids} = req.body;
    try {
        const deleteSales = await SaleService.deleteSalesByIds(ids);
        res.json({
            status: true,
            deleteSales
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Error deleting products', error })
    }
};
