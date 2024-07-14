import { IPedido } from "../entities/IPedido";
import { ISucursal } from "../entities/ISucursal";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";

export class Pedido{
    id_Pedido: number;
    tipo_De_Pago: string;
    fecha_Pedido: Date;
    hora_Entrega_Acordada: Date;
    hora_Entrega_Real: Date;
    observaciones: string;
    lugar_Entrega: string;
    costo_Delivery: number;
    cargo_Delivery: number;
    estado_Pedido: string;
    adelanto_Cliente: number;
    pagado_Al_Vendedor: number;
    subtotal_Qr: number;
    subtotal_Efectivo: number; 
    id_Vendedor: number;
    id_Trabajador: number;
    id_Sucursal: number;

    venta: IVenta[];
    sucursal: ISucursal[];
    vendedor: IVendedor;
    trabajador: ITrabajador;

    constructor(iPedido: IPedido){
        this.id_Pedido= iPedido.id_Pedido;
        this.tipo_De_Pago= iPedido.tipo_De_Pago;
        this.fecha_Pedido= iPedido.fecha_Pedido;
        this.hora_Entrega_Acordada= iPedido.hora_Entrega_Acordada;
        this.hora_Entrega_Real= iPedido.hora_Entrega_Real;
        this.observaciones= iPedido.observaciones;
        this.lugar_Entrega= iPedido.lugar_Entrega;
        this.costo_Delivery= iPedido.costo_Delivery;
        this.cargo_Delivery= iPedido.cargo_Delivery;
        this.estado_Pedido= iPedido.estado_Pedido;
        this.adelanto_Cliente= iPedido.adelanto_Cliente;
        this.pagado_Al_Vendedor= iPedido.pagado_Al_Vendedor;
        this.subtotal_Qr= iPedido.subtotal_Qr;
        this.subtotal_Efectivo= iPedido.subtotal_Efectivo;
        this.id_Vendedor= iPedido.id_Vendedor;
        this.id_Trabajador= iPedido.id_Trabajador;
        this.id_Sucursal= iPedido.id_Sucursal;
        this.venta= iPedido.venta;
        this.sucursal= iPedido.sucursal;
        this.vendedor= iPedido.vendedor;
        this.trabajador= iPedido.trabajador;
    }
}