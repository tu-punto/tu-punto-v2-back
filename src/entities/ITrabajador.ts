import { IPedido } from "./IPedido";
import { IVendedor } from "./IVendedor";

export interface ITrabajador{
    id_Trabajador: number;
    nombre: string;
    numero: number;
    rol: string;
    estado: string;

    vendedor?: IVendedor[];
    pedido?: IPedido[];
}