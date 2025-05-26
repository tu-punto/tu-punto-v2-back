import { SaleRepository } from "../repositories/sale.repository";
import { format } from 'date-fns';

const getAllSales = async () => {
    return await SaleRepository.findAll();
};

const registerSale = async (sale: any) => {
    return await SaleRepository.registerSale(sale);
}
const getProductsByShippingId = async (pedidoId: number) => {
    const sales = await SaleRepository.findByPedidoId(pedidoId);

    if (sales.length === 0) throw new Error("No existen ventas con ese ID de pedido");
    // Obtiene los productos junto con la cantidad
    const products = sales.map(sale => ({
        key: sale.producto._id,
        producto: sale.producto.nombre_producto,
        precio_unitario: sale.precio_unitario,
        cantidad: sale.cantidad,
        utilidad: sale.utilidad,
        id_venta: sale._id,
        id_vendedor: sale.producto.id_vendedor,
        id_pedido: pedidoId,
        id_producto: sale.producto._id
    }));


    return products;
}

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

    console.log(sales)
    if (sales.length === 0)
        return []
    //throw new Error("No existen ventas con ese ID de vendedor");
    const products = sales.map(sale => ({
        key: sale.producto._id,
        producto: sale.producto.nombre_producto,
        precio_unitario: sale.precio_unitario,
        cantidad: sale.cantidad,
        utilidad: sale.utilidad,
        id_venta: sale._id,
        id_vendedor: sellerId,
        id_pedido: sale.id_pedido,
        id_producto: sale.producto._id,
        deposito_realizado: sale.deposito_realizado,
        cliente: sale.pedido.cliente,
        fecha_pedido: sale.pedido.fecha_pedido
    }));


    return products;
}


const updateProducts = async (shippingId: number, prods: any[]) => {
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

const deleteProducts = async (shippingId: number, prods: any[]) => {
    const sale = await SaleRepository.findByPedidoId(shippingId)
    if (sale.length === 0) throw new Error(`No sales found for shippingId ${shippingId}`);
    return await SaleRepository.deleteProducts(sale, prods);
}
const deleteSalesByIds = async (saleIds: number[]) => {
    if (!saleIds || saleIds.length === 0) {
        throw new Error("No sale IDs provided for deletion.");
    }
    await SaleRepository.deleteSalesByIds(saleIds);
}

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

export const SaleService = {
    getAllSales,
    registerSale,
    getProductsByShippingId,
    getProductDetailsByProductId,
    updateProducts,
    deleteProducts,
    getProductsBySellerId,
    updateSales,
    deleteSalesByIds,
    getDataPaymentProof,
    updateSalesOfProducts,
    deleteSalesOfProducts
}