import { IPedido } from "../entities/IPedido";
import { IProducto } from "../entities/IProducto";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";

export class Venta {
    id_venta: number
    cantidad: number;
    precio_unitario: number;
    utilidad: number;
    deposito_realizado: boolean;

    producto: IProducto;
    pedido: IPedido;
    vendedor: IVendedor;

    constructor(iVenta: IVenta) {
        this.id_venta = iVenta.id_venta
        this.cantidad = iVenta.cantidad;
        this.precio_unitario = iVenta.precio_unitario;
        this.utilidad = iVenta.utilidad;
        this.deposito_realizado = iVenta.deposito_realizado;
        this.producto = iVenta.producto;
        this.pedido = iVenta.pedido;
        this.vendedor = iVenta.vendedor
    }
}