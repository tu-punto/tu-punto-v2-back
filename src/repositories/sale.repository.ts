import { In } from "typeorm";
import AppDataSource from "../config/dataSource";
import { ProductoEntity } from "../entities/implements/ProductoSchema";
import { VentaEntity } from "../entities/implements/VentaSchema";
import { IVenta } from "../entities/IVenta";
import { Venta } from "../models/Venta";

const saleRepository = AppDataSource.getRepository(VentaEntity);
const productRepository = AppDataSource.getRepository(ProductoEntity);

const findAll = async (): Promise<Venta[]> => {
  return await saleRepository.find();
};

const registerSale = async (sale: IVenta): Promise<Venta> => {
  const newSale = saleRepository.create(sale);
  const savedSale = await saleRepository.save(newSale);
  return new Venta(savedSale);
};
const findById = async (saleId: number) => {
  return await saleRepository.findOne({
    where: {
      id_venta: saleId,
    },
  });
};

const updateSale = async (sale: IVenta) => {
  const updatedSale = await saleRepository.save(sale);
  return updatedSale;
};

const findByPedidoId = async (pedidoId: number): Promise<VentaEntity[]> => {
  const sales = await saleRepository.find({
    where: { pedido: { id_pedido: pedidoId } },
    relations: ["producto"],
  });
  return sales;
};

const findByProductId = async (productId: number): Promise<VentaEntity[]> => {
  const sales = await saleRepository.find({
    where: {id_producto: productId},
    relations: ["producto", "pedido", "vendedor"],
  });
  return sales;
};
const findBySellerId = async (sellerId: number): Promise<VentaEntity[]> => {
  const sales = await saleRepository.find({
    where: { vendedor: { id_vendedor: sellerId } },
    relations: ["producto", "pedido"],
  });
  return sales;
};

const updateProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const updatedSales: any[] = [];

  for (const sale of sales) {
    for (const prod of prods) {
      if (prod.id_venta === sale.id_venta) {
        if (sale.producto && sale.producto.id_producto === prod.id_producto) {
          // Actualiza el producto con nuevos datos
          const updatedProduct = { ...sale, ...prod };
          updatedSales.push(await productRepository.save(updatedProduct));
        }
      }
    }
  }
  const newSaleData = await saleRepository.save(updatedSales);
  return newSaleData;
};

const updateSalesOfProducts = async (salesData: any[]): Promise<any[]> => {
  const ids = salesData.map(sale => sale.id_venta);
  const salesToUpdate = await saleRepository.findBy({ id_venta: In(ids) });
  salesToUpdate.forEach(sale => {
    const newData = salesData.find(s => s.id_venta === sale.id_venta);
    if (newData) {
      sale.cantidad = newData.cantidad;
      sale.precio_unitario = newData.precio_unitario;
    }
  });

  return await saleRepository.save(salesToUpdate);
};

const deleteSalesOfProducts = async (salesData: any[]): Promise<any[]> => {
  const ids = salesData.map(sale => sale.id_venta);
  await saleRepository.delete({ id_venta: In(ids) });
  return ids;
};

const deleteProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
  const deletedProducts: any[] = [];
  const productsToDelete = new Set(
    prods.map((prod) => `${prod.id_venta}-${prod.id_producto}`)
  );

  for (const sale of sales) {
    const key = `${sale.id_venta}-${sale.producto.id_producto}`;
    if (productsToDelete.has(key)) {
      await saleRepository.delete({
        id_producto: sale.producto.id_producto,
        id_venta: sale.id_venta,
      });
      deletedProducts.push({
        id_venta: sale.id_venta,
        id_producto: sale.producto.id_producto,
      });
    }
  }
  return deletedProducts;
};
const deleteSalesByIds = async (saleIds:number[]): Promise<any> => {
    await saleRepository.delete({ id_venta: In(saleIds) });
};

const getDataPaymentProof = async (sellerId: number) => {
  const data = await saleRepository.find({
    where: {
      deposito_realizado: false,
      id_vendedor: sellerId
    },
    relations: [
      "producto", "pedido"
    ]
  })
  return data
} 

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
}
