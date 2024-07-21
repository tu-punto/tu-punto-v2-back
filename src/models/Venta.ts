import { IPedido } from "../entities/IPedido";
import { IProducto } from "../entities/IProducto";
import { IVenta } from "../entities/IVenta";

export class Venta{
    id_venta: number
    cantidad: number;
    precio_unitario: number;
    utilidad: number;
    utilidad_extra: number;

    producto: IProducto;
    pedido: IPedido;

    constructor(iVenta: IVenta){
        this.id_venta = iVenta.id_venta
        this.cantidad= iVenta.cantidad;
        this.precio_unitario= iVenta.precio_unitario;
        this.utilidad= iVenta.utilidad;
        this.utilidad_extra= iVenta.utilidad_extra;
        this.producto= iVenta.producto;
        this.pedido= iVenta.pedido;
    }
}