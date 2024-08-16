import AppDataSource from "../config/dataSource";
import { ProductoEntity } from "../entities/implements/ProductoEntity";
import { VentaEntity } from "../entities/implements/VentaEntity";
import { IVenta } from "../entities/IVenta";
import { Venta } from "../models/Venta";

const saleRepository = AppDataSource.getRepository(VentaEntity)
const productRepository = AppDataSource.getRepository(ProductoEntity);

const findAll = async (): Promise<Venta[]> => {
    return await saleRepository.find()
}

const registerSale = async (sale: IVenta): Promise<Venta> => {
    const newSale = saleRepository.create(sale);
    const savedSale = await saleRepository.save(newSale);
    return new Venta(savedSale);
}
const findByPedidoId = async (pedidoId: number): Promise<VentaEntity[]> => {
    //console.log(`Searching for sales with pedidoId: ${pedidoId}`);
    const sales = await saleRepository.find({
        where: { pedido: { id_pedido: pedidoId } },
        relations: ['producto']
    });
    //console.log(`Sales found: ${JSON.stringify(sales)}`);
    return sales;
}
const findBySellerId = async (sellerId: number): Promise<VentaEntity[]> => {
    //console.log(`Searching for sales with pedidoId: ${pedidoId}`);
    const sales = await saleRepository.find({
        where: { vendedor: { id_vendedor: sellerId } },
        relations: ['producto']
    });
    //console.log(`Sales found: ${JSON.stringify(sales)}`);
    return sales;
}

// const updateProducts = async (sales: any[], prods: any[]) => {
//     const updatedSales: any[] = [];
//     for (const prod of prods) {

//         if (prod.id_venta) {
//             if (sale.producto && sale.producto.id_producto === prod.id_producto) {
//                 // Actualiza el producto con nuevos datos
//                 const updatedProduct = { ...sale, ...prod };
//                 await productRepository.save(updatedProduct);
//                 updatedSales.push(updatedProduct);
//             }
//         } else {
//             // Agregar nuevo producto
//             // const newProduct = productRepository.create(prod);
//             // await productRepository.save(newProduct);
//             console.log("Aca no es eh")
//         }
//     }
//     console.log(updatedSales)
//     const newSaleData = await saleRepository.save(updatedSales);
//     return newSaleData;
// };

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
const deleteProducts = async (sales: any[], prods: any[]): Promise<any[]> => {
    const deletedProducts: any[] = [];
    const productsToDelete = new Set(prods.map(prod => `${prod.id_venta}-${prod.id_producto}`));

    for (const sale of sales) {
        const key = `${sale.id_venta}-${sale.producto.id_producto}`;
        if (productsToDelete.has(key)) {
            await saleRepository.delete({ id_producto: sale.producto.id_producto, id_venta: sale.id_venta });
            deletedProducts.push({ id_venta: sale.id_venta, id_producto: sale.producto.id_producto});
        }
    }
    return deletedProducts;
};


export const SaleRepository = {
    findAll,
    registerSale,
    findByPedidoId,
    updateProducts,
    deleteProducts,
    findBySellerId
}