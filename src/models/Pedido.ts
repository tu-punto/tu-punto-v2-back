/* import { IPedido } from "../entities/IPedido";
import { ISucursal } from "../entities/ISucursal";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";

export class Pedido {
    id_pedido: number;
    cliente: string;
    telefono_cliente: number;
    tipo_de_pago: string;
    fecha_pedido: Date;
    hora_entrega_acordada: Date;
    hora_entrega_real: Date;
    observaciones: string;
    lugar_entrega: string;
    costo_delivery: number;
    cargo_delivery: number;
    estado_pedido: string;
    adelanto_cliente: number;
    pagado_al_vendedor: boolean;
    subtotal_qr: number;
    subtotal_efectivo: number;
    id_trabajador: number;
    id_sucursal: number;

    venta: IVenta[];
    sucursal: ISucursal[];
    trabajador: ITrabajador;

    constructor(iPedido: IPedido) {
        this.id_pedido = iPedido.id_pedido;
        this.cliente = iPedido.cliente;
        this.telefono_cliente = iPedido.telefono_cliente;
        this.tipo_de_pago = iPedido.tipo_de_pago;
        this.fecha_pedido = iPedido.fecha_pedido;
        this.hora_entrega_acordada = iPedido.hora_entrega_acordada;
        this.hora_entrega_real = iPedido.hora_entrega_real;
        this.observaciones = iPedido.observaciones;
        this.lugar_entrega = iPedido.lugar_entrega;
        this.costo_delivery = iPedido.costo_delivery;
        this.cargo_delivery = iPedido.cargo_delivery;
        this.estado_pedido = iPedido.estado_pedido;
        this.adelanto_cliente = iPedido.adelanto_cliente;
        this.pagado_al_vendedor = iPedido.pagado_al_vendedor;
        this.subtotal_qr = iPedido.subtotal_qr;
        this.subtotal_efectivo = iPedido.subtotal_efectivo;
        this.id_trabajador = iPedido.id_trabajador;
        this.id_sucursal = iPedido.id_sucursal;
        this.venta = iPedido.venta;
        this.sucursal = iPedido.sucursal;
        this.trabajador = iPedido.trabajador;
    }
} */