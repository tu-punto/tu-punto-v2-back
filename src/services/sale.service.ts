import { format } from 'date-fns';
import { Types } from 'mongoose';

import { SaleRepository } from "../repositories/sale.repository";
import { SellerService } from "./seller.service";
import { ProductService } from './product.service';
import { PedidoModel } from "../entities/implements/PedidoSchema"; // asegúrate de importar esto
import { VentaModel } from '../entities/implements/VentaSchema';

const getAllSales = async () => {
    return await SaleRepository.findAll();
};

const registerSale = async (sale: any) => {
  const salesArray = Array.isArray(sale) ? sale : [sale];

  const transformedSales = salesArray.map(s => ({
    ...s,
    producto: new Types.ObjectId(s.id_producto),
    pedido: new Types.ObjectId(s.id_pedido),
    vendedor: new Types.ObjectId(s.id_vendedor),
    quien_paga_delivery: s.quien_paga_delivery || 'comprador',
    nombre_variante: s.nombre_variante || '',
  }));

  const savedSales = [];
  for (const saleData of transformedSales) {
    const saved = await SaleRepository.registerSale(saleData);
    savedSales.push(saved);

    // Añadir ID al pedido (como vimos antes)
    await PedidoModel.findByIdAndUpdate(
      saleData.pedido,
      { $addToSet: { venta: saved._id } }
    );
  }

    return savedSales;
};
const registerMultipleSales = async (sales: any[]) => {
   console.log("📥 [Service] Registro múltiple - ventas recibidas:", JSON.stringify(sales, null, 2));
 
  const savedSales = [];

  for (const sale of sales) {
  const savedList = await SaleService.registerSale(sale);
  for (const saved of savedList) {
    savedSales.push(saved);
    await PedidoModel.findByIdAndUpdate(
      sale.id_pedido,
      { $addToSet: { venta: saved._id } }
    );
  }
    }

  return savedSales;
};


const getProductsByShippingId = async (pedidoId: number) => {
    // Obtener las ventas asociadas
    const sales = await SaleRepository.findByPedidoId(pedidoId);

    // Obtener el pedido completo (para productos temporales)
    const pedido = await PedidoModel.findById(pedidoId);

    if (!pedido) throw new Error("No existe el pedido");

    const ventas = sales.map(sale => ({
        key: sale.producto._id,
        producto: sale.producto.nombre_producto,
        nombre_variante: sale.nombre_variante,
        precio_unitario: sale.precio_unitario,
        cantidad: sale.cantidad,
        utilidad: sale.utilidad,
        id_venta: sale._id,
        id_vendedor: sale.producto.id_vendedor,
        id_pedido: pedidoId,
        id_producto: sale.producto._id
    }));

    const temporales = (pedido.productos_temporales || []).map((prod, i) => ({
        key: `temp-${i}`,
        producto: prod.producto,
        cantidad: prod.cantidad,
        precio_unitario: prod.precio_unitario,
        utilidad: prod.utilidad,
        id_vendedor: prod.id_vendedor,
        esTemporal: true,
    }));

    return [...ventas, ...temporales];
};

const getProductDetailsByProductId = async (productId: number) => {
    const sales = await SaleRepository.findByProductId(productId);

    if (sales.length === 0) throw new Error("No existen ventas con ese ID de producto");

    const products = sales.map(sale => {
        const formattedDate = format(new Date(sale.pedido.fecha_pedido), 'dd/MM/yyyy:HH:mm:ss');

        return {
            key: `${sale.producto._id}-${formattedDate}`,
            producto: sale.producto.nombre_producto,
            precio_unitario: sale.precio_unitario,
            cantidad: sale.cantidad,
            utilidad: sale.utilidad,
            id_venta: sale._id,
            id_vendedor: sale.producto.id_vendedor,
            id_pedido: sale.id_pedido,
            id_producto: sale.producto._id,
            deposito_realizado: sale.deposito_realizado,
            cliente: sale.pedido.cliente,
            fecha_pedido: sale.pedido.fecha_pedido,
            nombre_vendedor: `${sale.vendedor.nombre} ${sale.vendedor.apellido} - ${sale.vendedor.marca}`,
        };
    });

    return products;
};
const getProductsBySellerId = async (sellerId: string) => {
    const sales = await SaleRepository.findBySellerId(sellerId);

    if (sales.length === 0)
        return []
    //throw new Error("No existen ventas con ese ID de vendedor");
    const products = sales.map((sale) => {

        return {
            key: sale.producto._id,
            producto: sale.producto.nombre_producto,
            nombre_variante: sale.nombre_variante,
            precio_unitario: sale.precio_unitario,
            cantidad: sale.cantidad,
            utilidad: sale.utilidad,
            id_venta: sale._id,
            id_vendedor: sellerId,
            id_pedido: sale.pedido,
            id_producto: sale.producto._id,
            deposito_realizado: sale.deposito_realizado,
            cliente: sale.pedido.cliente,
            fecha_pedido: sale.pedido.fecha_pedido
        }
    });


    return products;
}


const updateProducts = async (shippingId: any, prods: any[]) => {
    const sale = await SaleRepository.findByPedidoId(shippingId)
    if (!sale) throw new Error(`Shipping with id ${shippingId} doesn't exist`);
    return await SaleRepository.updateProducts(sale, prods);
}

const updateSales = async (sales: any[]) => {
    const updatedSales = [];
    for (const sale of sales) {
        const isSale = await SaleRepository.findById(sale.id_venta);
        if (isSale) {
            const saleUpdate = {
                id_venta: sale.id_venta,
                cantidad: sale.cantidad,
                precio_unitario: sale.precio_unitario,
                utilidad: sale.utilidad,
                deposito_realizado: sale.deposito_realizado,
                ...(sale.id_producto && { id_producto: sale.id_producto }),
            };
            const updatedSale = await SaleRepository.updateSale(saleUpdate);
            updatedSales.push(updatedSale);
        }
        else {
            throw new Error(`No sale found with that saleId ${sale.id_venta}`)
        }
    }
    return updatedSales;
};

const updateSalesOfProducts = async (stockData: any[]) => {
    return await SaleRepository.updateSalesOfProducts(stockData);
};

const deleteProducts = async (shippingId: any, prods: any[]) => {
    const sale = await SaleRepository.findByPedidoId(shippingId)
    if (sale.length === 0) throw new Error(`No sales found for shippingId ${shippingId}`);
    return await SaleRepository.deleteProducts(sale, prods);
}
const deleteSalesByIdsAndPullFromPedido = async (pedidoId: string, ventaIds: string[]) => {
  await VentaModel.deleteMany({ _id: { $in: ventaIds } });

  await PedidoModel.findByIdAndUpdate(
    pedidoId,
    { $pull: { venta: { $in: ventaIds.map(id => new Types.ObjectId(id)) } } }
  );

  return ventaIds;
};

const deleteSalesByIds = async (saleIds: string[]): Promise<any> => {
  const ventas = await VentaModel.find({ _id: { $in: saleIds } });

  for (const venta of ventas) {
    await PedidoModel.findByIdAndUpdate(
      venta.pedido,
      { $pull: { venta: venta._id } }
    );
  }

  await VentaModel.deleteMany({ _id: { $in: saleIds } });
};

const deleteSalesOfProducts = async (stockData: any[]) => {
    return await SaleRepository.deleteSalesOfProducts(stockData);
};

const getDataPaymentProof = async (sellerId: number) => {
    const data = await SaleRepository.getDataPaymentProof(sellerId)

    const products = data.map(venta => ({
        producto: venta.producto.nombre_producto,
        unitario: venta.precio_unitario,
        cantidad: venta.cantidad,
        total: venta.precio_unitario * venta.cantidad
    }))

    const payments = data.filter(venta => venta.pedido.adelanto_cliente !== 0)
        .map(venta => ({
            date: venta.pedido.fecha_pedido.toLocaleDateString(),
            client: venta.pedido.adelanto_cliente
        }))

    return { products, payments }
}

const updateSaleById = async (id: string, fields: any) => {
    const venta = await SaleRepository.findById(id);
    const { id_sucursal, cantidad, precio_unitario, ...others } = fields;

    if (!venta) {
        console.error(`Sale with id ${id} not found`);
        return null;
    }
    const cleanedNombreVariante = venta.nombre_variante?.trim().replace(/[\s/-]+/g, '');
    const cleanedNombreProducto = venta.producto.nombre_producto?.trim().replace(/\s+/g, '').replace(/-+/g, '');

    const producto = await ProductService.getProductById(venta.producto._id!.toString());
    const sucursal = producto.sucursales.find(s => s.id_sucursal.toString() === id_sucursal);

    if (!sucursal) {
        console.error(`Sucursal with id ${id_sucursal} not found in product ${producto.nombre_producto}`);
        return null;
    }

    let indexToUpdate = -1;
    const varianteToUpdate = sucursal.combinaciones.find((combinacion, index) => {
        const variantes: any = combinacion.variantes;
        let variantName = '';
        for (const [key, value] of variantes.entries()) {
            variantName += value.trim().replace(/[\s/-]+/g, '');
        }
        if (`${cleanedNombreProducto}${variantName}` === cleanedNombreVariante) {
            indexToUpdate = index;
            return combinacion;
        }
    });

    if (!varianteToUpdate) {
        console.error(`Variante with name ${venta.nombre_variante} not found in product ${producto.nombre_producto}`);
        return null;
    }

    const oldStock = varianteToUpdate.stock;
    const stockAdjustment = venta.cantidad - cantidad;
    const newStock = oldStock + stockAdjustment;

    if (newStock < 0) {
        throw new Error("No hay suficiente stock disponible para realizar la operación.");
    }

    sucursal.combinaciones[indexToUpdate].stock = newStock;

    await ProductService.updateProduct(producto._id!.toString(), { sucursales: [...producto.sucursales, sucursal] });
    const addPendingSaldo = -(venta.cantidad * venta.precio_unitario) + (cantidad * precio_unitario);
    const updated = await SaleRepository.updateSale({ _id: id, cantidad, precio_unitario, ...others });
    await SellerService.updateSellerSaldo(venta.vendedor, addPendingSaldo);

    return updated;
};

const deleteSaleById = async (id: string, id_sucursal: string) => {
    const venta = await SaleRepository.findById(id);
    if (!venta) return null;
    const cleanedNombreVariante = venta.nombre_variante?.trim().replace(/[\s/-]+/g, '');
    const cleanedNombreProducto = venta.producto.nombre_producto?.trim().replace(/\s+/g, '').replace(/-+/g, '');

    const producto = await ProductService.getProductById(venta.producto._id!.toString());
    const sucursal = producto.sucursales.find(s => s.id_sucursal.toString() === id_sucursal);
    if (!sucursal) {
        console.error(`Sucursal with id ${id_sucursal} not found in product ${producto.nombre_producto}`);
        return null;
    }
    let indexToUpdate = -1;
    const varianteToUpdate = sucursal.combinaciones.find((combinacion, index) => {
        const variantes: any = combinacion.variantes;
        let variantName = '';
        for (const [key, value] of variantes.entries()) {
            variantName += value.trim().replace(/[\s/-]+/g, '');
        }
        if (`${cleanedNombreProducto}${variantName}` === cleanedNombreVariante) {
            indexToUpdate = index;
            return combinacion;
        }
    });

    if (!varianteToUpdate) {
        console.error(`Variante with name ${venta.nombre_variante} not found in product ${producto.nombre_producto}`);
        return null;
    }

    sucursal.combinaciones[indexToUpdate].stock += venta.cantidad
    const resProduct = await ProductService.updateProduct(producto._id!.toString(), { sucursales: [...producto.sucursales, sucursal] });
    if (!resProduct) {
        console.error(`Error updating product ${producto.nombre_producto} stock after deleting sale ${id}`);
        return null;
    }

    const res = await SaleRepository.deleteSaleById(id);
    return res

};

export const SaleService = {
    getAllSales,
    registerSale,
    registerMultipleSales,
    getProductsByShippingId,
    getProductDetailsByProductId,
    updateProducts,
    deleteProducts,
    getProductsBySellerId,
    updateSales,
    deleteSalesByIds,
    getDataPaymentProof,
    updateSalesOfProducts,
    deleteSalesOfProducts,
    updateSaleById,
    deleteSaleById,
    deleteSalesByIdsAndPullFromPedido,

}