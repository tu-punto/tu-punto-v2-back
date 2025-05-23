import { Types } from 'mongoose';
import { ICierreCaja } from "./ICierreCaja";
import { IIngreso } from "./IIngreso";
import { IPedido } from "./IPedido";
import { ITrabajador } from "./ITrabajador";

export interface ISucursal {
    id_sucursal: number;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: number;
     
    pedido?: Types.ObjectId[];  
    trabajador: Types.ObjectId[]; 
    ingreso?: Types.ObjectId[];  
    cierre_caja: Types.ObjectId[]; 
}
