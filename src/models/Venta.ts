import { IPedido } from "../entities/IPedido";
import { IProducto } from "../entities/IProducto";
import { IVenta } from "../entities/IVenta";

export class Venta{
    //dos afk
    id_Producto: number;
    id_Pedido: number;
    cantidad: number;
    precio_Unitario: number;
    utilidad: number;
    utilidad_Extra: number;

    producto: IProducto[];
    pedido: IPedido[];

    constructor(iVenta: IVenta){
        this.id_Producto= iVenta.id_Producto;
        this.id_Pedido= iVenta.id_Pedido;
        this.cantidad= iVenta.cantidad;
        this.precio_Unitario= iVenta.precio_Unitario;
        this.utilidad= iVenta.utilidad;
        this.utilidad_Extra= iVenta.utilidad_Extra;
        this.producto= iVenta.producto;
        this.pedido= iVenta.pedido;
    }
}