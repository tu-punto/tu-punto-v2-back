import { VentaModel } from "../entities/implements/VentaSchema";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { IVenta } from "../entities/IVenta";
import { IVentaDocument } from "../entities/documents/IVentaDocument";


const findAll = async (): Promise<IVentaDocument[]> => {
  return await VentaModel.find().populate(['producto', 'pedido', 'vendedor']);
};


const registerSale = async (sale: IVenta): Promise<IVentaDocument> => {
  const newSale = new VentaModel(sale);
  const saved = await newSale.save();
  return saved;
};


const findById = async (saleId: string) => {
  return await VentaModel.findOne({ _id: saleId }).populate(['producto', 'pedido', 'vendedor']);
};

const updateSale = async (sale: IVenta) => {
  return await VentaModel.findByIdAndUpdate(sale._id, sale, { new: true });
};


const findByPedidoId = async (pedidoId: number) => {
  return await VentaModel.find({ pedido: pedidoId }).populate(['producto']);
};

const findByProductId = async (productId: number) => {
  return await VentaModel.find({ producto: productId }).populate(['producto', 'pedido', 'vendedor']);
};

const findBySellerId = async (sellerId: string) => {
  return await VentaModel.find({ vendedor: sellerId }).populate(['producto', 'pedido']);
};

const updateProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const updatedSales: any[] = [];

  for (const sale of sales) {
    for (const prod of prods) {
      if (prod._id === sale._id && sale.producto?._id === prod._id) {
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
      { _id: sale._id },
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
  const ids = salesData.map(s => s._id);
  await VentaModel.deleteMany({ _id: { $in: ids } });
  return ids;
};

const deleteProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const deletedProducts: any[] = [];
  const keys = new Set(prods.map(p => `${p._id}-${p._id}`));

  for (const sale of sales) {
    const key = `${sale._id}-${sale.producto._id}`;
    if (keys.has(key)) {
      await VentaModel.deleteOne({
        _id: sale._id,
        producto: sale.producto._id,
      });
      deletedProducts.push({ _id: sale._id, id_producto: sale.producto._id });
    }
  }

  return deletedProducts;
};

const deleteSalesByIds = async (saleIds: number[]): Promise<any> => {
  await VentaModel.deleteMany({ _id: { $in: saleIds } });
};

const getDataPaymentProof = async (sellerId: number) => {
  return await VentaModel.find({
    deposito_realizado: false,
    vendedor: sellerId
  }).populate(['producto', 'pedido']);
};

const deleteSaleById = async (id: string) => {
  await VentaModel.deleteOne({ _id: id });
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
  deleteSalesOfProducts,
  deleteSaleById
};

