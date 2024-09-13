import { IFlujoFinanciero } from "./IFlujoFinanciero";
import { IPedido } from "./IPedido";
import { ISucursal } from "./ISucursal";
import { IUser } from "./IUser";
import { IVendedor } from "./IVendedor";

export interface ITrabajador {
    id_trabajador: number;
    nombre: string;
    numero: number;
    rol: string;
    estado: string;

    user: IUser
    vendedor?: IVendedor[];
    pedido?: IPedido[];
    flujoFinanciero?: IFlujoFinanciero[];
    sucursal: ISucursal[];
}