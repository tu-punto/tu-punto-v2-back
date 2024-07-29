import { ISucursal } from "./ISucursal";
import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";
import { IVenta } from "./IVenta";

export interface IPedido {
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
}