import { SaleRepository } from "../repositories/sale.repository";

const getAllSales = async () => {
    return await SaleRepository.findAll();
};

const registerSale = async (sale:any) => {
    return await SaleRepository.registerSale(sale);
}
const getProductsById = async (pedidoId: number) => {
    //console.log(`Fetching sales for pedidoId: ${pedidoId}`);
    const sales = await SaleRepository.findByPedidoId(pedidoId);

    if (sales.length === 0) throw new Error("No existen ventas con ese ID de pedido");
    // Obtiene los productos junto con la cantidad
    const products = sales.map(sale => ({
        key: sale.producto.id_producto,
        producto: sale.producto.nombre_producto,
        precio_unitario: sale.precio_unitario,
        cantidad: sale.cantidad,
        utilidad: sale.utilidad,
        id_venta: sale.id_venta,
        id_vendedor: sale.producto.id_vendedor,
        id_pedido: pedidoId,
        id_producto: sale.producto.id_producto
    }));


    return products;
}
const getProductsBySellerId = async (sellerId: number) => {
    const sales = await SaleRepository.findBySellerId(sellerId);

    if (sales.length === 0) throw new Error("No existen ventas con ese ID de vendedor");
    const products = sales.map(sale => ({
        key: sale.producto.id_producto,
        producto: sale.producto.nombre_producto,
        precio_unitario: sale.precio_unitario,
        cantidad: sale.cantidad,
        utilidad: sale.utilidad,
        id_venta: sale.id_venta,
        id_vendedor: sellerId,
        id_pedido: sale.id_pedido,
        id_producto: sale.producto.id_producto,
        deposito_realizado: sale.deposito_realizado
    }));


    return products;
}
const updateProducts = async (shippingId:number, prods:any[])=>{
    const sale= await SaleRepository.findByPedidoId(shippingId)
    //console.log(sale)
    if(!sale) throw new Error(`Shipping with id ${shippingId} doesn't exist`);
    return await SaleRepository.updateProducts(sale, prods);
}

const deleteProducts = async (shippingId:number, prods:any[])=>{
    const sale= await SaleRepository.findByPedidoId(shippingId)
    //console.log(sale)
    if (sale.length === 0) throw new Error(`No sales found for shippingId ${shippingId}`);
    return await SaleRepository.deleteProducts(sale, prods);
}
export const SaleService = {
    getAllSales,
    registerSale,
    getProductsById,
    updateProducts,
    deleteProducts,
    getProductsBySellerId
}