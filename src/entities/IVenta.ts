import { IPedido } from "./IPedido";
import { IProducto } from "./IProducto";
import { IVendedor } from "./IVendedor";

export interface IVenta{
    id_venta: number
    id_pedido: number,
    id_vendedor: number,
    id_producto: number,
    cantidad: number;
    precio_unitario: number;
    utilidad: number;
    deposito_realizado: boolean;

    producto: IProducto;
    pedido: IPedido;
    vendedor: IVendedor;
}