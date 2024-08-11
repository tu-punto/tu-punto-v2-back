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
    id_pedido: number;
    id_vendedor: number;
    id_producto: number;
    producto: IProducto;
    pedido: IPedido;
    vendedor: IVendedor;

    constructor(iVenta: IVenta) {
        this.id_venta = iVenta.id_venta
        this.cantidad = iVenta.cantidad;
        this.precio_unitario = iVenta.precio_unitario;
        this.utilidad = iVenta.utilidad;
        this.deposito_realizado = iVenta.deposito_realizado;
        this.id_pedido = iVenta.id_pedido
        this.id_vendedor = iVenta.id_vendedor
        this.id_producto = iVenta.id_producto
        this.producto = iVenta.producto;
        this.pedido = iVenta.pedido;
        this.vendedor = iVenta.vendedor
    }
}