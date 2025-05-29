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

export const getProductsByShippingId = async (req: Request, res: Response) => {
  const id: number = parseInt(req.params.id);
  try {
    const products = await SaleService.getProductsByShippingId(id);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};

export const getProductDetailsByProductId = async (req: Request, res: Response) => {
  const id: number = parseInt(req.params.id);
  try {
    const productDetails = await SaleService.getProductDetailsByProductId(id);
    res.json(productDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error getting product details", error });
  }
};
export const getProductsBySellerId = async (req: Request, res: Response) => {
  const sellerId = req.params.id;
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
    console.error(error);
    res.status(500).json({ msg: "Error updating products", error });
  }
};

export const updateSales = async (req: Request, res: Response) => {
  const sales = req.body.sales;
  try {
    const salesUpdated = await SaleService.updateSales(sales);
    res.status(200).json({
      status: "success",
      message: `${salesUpdated.length} sales updated successfully`,
      data: salesUpdated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error updating sales", error });
  }
};

export const updateSalesOfProducts = async (req: Request, res: Response) => {
  const stockData = req.body;
  try {
    const updatedStock = await SaleService.updateSalesOfProducts(stockData);
    res.json({
      status: true,
      updatedStock,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error updating product stock", error });
  }
};

export const deleteSalesOfProducts = async (req: Request, res: Response) => {
  const salesData = req.body;
  try {
    const deletedSales = await SaleService.deleteSalesOfProducts(salesData);
    res.json({
      status: true,
      deletedSales,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error deleting product sales", error });
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
    console.error(error);
    res.status(500).json({ msg: "Error deleting products", error });
  }
}

export const deleteSales = async (req: Request, res: Response) => {
  const sales  = req.body.sales;
  try {
    const saleIds = sales.map((sale:any) => sale.id_venta);

    if (!saleIds || saleIds.length === 0) {
      return res.status(400).json({ msg: 'No sale IDs provided for deletion.' });
    }

    const deletedSales = await SaleService.deleteSalesByIds(saleIds);
    res.json({
      status: true,
      deletedSales
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error deleting products', error })
  }
};

export const getDataPaymentProof = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  try {
    const data = await SaleService.getDataPaymentProof(id)
    res.status(200).json(data)
  } catch (error) {
    
  }
}

export const updateSaleById = async (req: Request, res: Response) => {
  const id = req.params.id;
  const fieldsToUpdate = req.body;

  try {
    const updatedSale = await SaleService.updateSaleById(id, fieldsToUpdate);
    if (!updatedSale) {
      return res.status(404).json({ msg: 'Venta no encontrada' });
    }

    res.status(200).json({
      success: true,
      updatedSale,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error actualizando venta', error });
  }
};

export const deleteSaleById = async (req: Request, res: Response) => {
  const id = req.params.id;

  try {
    const deleted = await SaleService.deleteSaleById(id);
    if (!deleted) {
      return res.status(404).json({ msg: 'Venta no encontrada o ya eliminada' });
    }

    res.status(200).json({
      success: true,
      deletedSale: id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error eliminando venta', error });
  }
};