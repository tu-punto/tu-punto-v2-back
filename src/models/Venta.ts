import { IPedido } from "../entities/IPedido";
import { IProducto } from "../entities/IProducto";
import { IVenta } from "../entities/IVenta";

export class Venta{
    idVenta: number
    cantidad: number;
    precio_Unitario: number;
    utilidad: number;
    utilidad_Extra: number;

    producto: IProducto;
    pedido: IPedido;

    constructor(iVenta: IVenta){
        this.idVenta = iVenta.idVenta
        this.cantidad= iVenta.cantidad;
        this.precio_Unitario= iVenta.precio_Unitario;
        this.utilidad= iVenta.utilidad;
        this.utilidad_Extra= iVenta.utilidad_Extra;
        this.producto= iVenta.producto;
        this.pedido= iVenta.pedido;
    }
}