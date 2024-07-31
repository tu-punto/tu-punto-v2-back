import { ProductRepository } from "../repositories/product.repository";
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
    //console.log(`Sales found: ${JSON.stringify(sales)}`);

    if (sales.length === 0) throw new Error("No existen ventas con ese ID de pedido");

    // Obtiene los productos junto con la cantidad
    const products = sales.map(sale => ({
        key: sale.producto.id_producto,
        producto: sale.producto.nombre_producto,
        precio_unitario: sale.producto.precio,
        cantidad: sale.cantidad,
        utilidad: sale.utilidad
    }));

    //console.log(`Products with quantities: ${JSON.stringify(products)}`);

    return products;
}
export const SaleService = {
    getAllSales,
    registerSale,
    getProductsById
}