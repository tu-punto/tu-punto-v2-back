import { ISucursal } from "./ISucursal";
import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";
import { IVenta } from "./IVenta";

export interface IPedido{
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
}