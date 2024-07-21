import { IPedido } from "./IPedido";
import { IProducto } from "./IProducto";

export interface IVenta{
    id_venta: number
    cantidad: number;
    precio_unitario: number;
    utilidad: number;
    utilidad_extra: number;

    producto: IProducto;
    pedido: IPedido;
}