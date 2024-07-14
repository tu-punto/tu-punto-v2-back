import { IPedido } from "./IPedido";
import { IProducto } from "./IProducto";

export interface IVenta{
    //dos afk
    id_Producto: number;
    id_Pedido: number;
    cantidad: number;
    precio_Unitario: number;
    utilidad: number;
    utilidad_Extra: number;

    producto: IProducto[];
    pedido: IPedido[];
}