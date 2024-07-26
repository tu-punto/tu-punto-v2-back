import { IPedido } from "./IPedido";
import { ISucursal } from "./ISucursal";
import { IVendedor } from "./IVendedor";

export interface ITrabajador{
    id_trabajador: number;
    nombre: string;
    numero: number;
    rol: string;
    estado: string;

    vendedor?: IVendedor[];
    pedido?: IPedido[];
    sucursal: ISucursal[];
}