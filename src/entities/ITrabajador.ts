import { Types } from 'mongoose';
import { IUser } from "./IUser";
import { IVendedor } from "./IVendedor";
import { IPedido } from "./IPedido";
import { IFlujoFinanciero } from "./IFlujoFinanciero";
import { ISucursal } from "./ISucursal";

export interface ITrabajador {
    id_trabajador: number;
    nombre: string;
    numero: number;
    rol: string;
    estado: string;

    user: Types.ObjectId;
    vendedor?: Types.ObjectId[];
    pedido?: Types.ObjectId[];
    flujoFinanciero?: Types.ObjectId[];
    sucursal: Types.ObjectId[];
}

