import { VentaModel } from "../entities/implements/VentaSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { IVenta } from "../entities/IVenta";
import { IVentaDocument } from "../entities/documents/IVentaDocument";
import mongoose from "mongoose";


const findAll = async (): Promise<IVentaDocument[]> => {
  return await VentaModel.find().populate(['producto', 'pedido', 'vendedor']);
};


const registerSale = async (sale: IVenta): Promise<IVentaDocument> => {
  const newSale = new VentaModel(sale);
  const saved = await newSale.save();
  return saved;
};


const findById = async (saleId: number) => {
  return await VentaModel.findOne({ id_venta: saleId }).populate(['producto', 'pedido', 'vendedor']);
};

const updateSale = async (sale: IVenta) => {
  return await VentaModel.findByIdAndUpdate(sale._id, sale, { new: true });
};


const findByPedidoId = async (pedidoId: number) => {
  return await VentaModel.find({ id_pedido: pedidoId }).populate(['producto']);
};

const findByProductId = async (productId: number) => {
  return await VentaModel.find({ id_producto: productId }).populate(['producto', 'pedido', 'vendedor']);
};

const findBySellerId = async (sellerId: number) => {
  return await VentaModel.find({ id_vendedor: sellerId }).populate(['producto', 'pedido']);
};

const updateProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const updatedSales: any[] = [];

  for (const sale of sales) {
    for (const prod of prods) {
      if (prod.id_venta === sale.id_venta && sale.producto?.id_producto === prod.id_producto) {
        const updated = await ProductoModel.findOneAndUpdate(
          { _id: sale.producto._id },
          { ...prod },
          { new: true }
        );
        updatedSales.push(updated);
      }
    }
  }

  return updatedSales;
};

const updateSalesOfProducts = async (salesData: any[]): Promise<any[]> => {
  const updated: any[] = [];

  for (const sale of salesData) {
    const updatedSale = await VentaModel.findOneAndUpdate(
      { id_venta: sale.id_venta },
      {
        cantidad: sale.cantidad,
        precio_unitario: sale.precio_unitario,
      },
      { new: true }
    );
    updated.push(updatedSale);
  }

  return updated;
};

const deleteSalesOfProducts = async (salesData: any[]): Promise<any[]> => {
  const ids = salesData.map(s => s.id_venta);
  await VentaModel.deleteMany({ id_venta: { $in: ids } });
  return ids;
};

const deleteProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const deletedProducts: any[] = [];
  const keys = new Set(prods.map(p => `${p.id_venta}-${p.id_producto}`));

  for (const sale of sales) {
    const key = `${sale.id_venta}-${sale.producto.id_producto}`;
    if (keys.has(key)) {
      await VentaModel.deleteOne({
        id_venta: sale.id_venta,
        id_producto: sale.producto.id_producto,
      });
      deletedProducts.push({ id_venta: sale.id_venta, id_producto: sale.producto.id_producto });
    }
  }

  return deletedProducts;
};

const deleteSalesByIds = async (saleIds: number[]): Promise<any> => {
  await VentaModel.deleteMany({ id_venta: { $in: saleIds } });
};

const getDataPaymentProof = async (sellerId: number) => {
  return await VentaModel.find({
    deposito_realizado: false,
    id_vendedor: sellerId
  }).populate(['producto', 'pedido']);
};


export const SaleRepository = {
  findAll,
  registerSale,
  findByPedidoId,
  findByProductId,
  updateSalesOfProducts,
  updateProducts,
  deleteProducts,
  findBySellerId,
  findById,
  updateSale,
  deleteSalesByIds,
  getDataPaymentProof,
  deleteSalesOfProducts
};

