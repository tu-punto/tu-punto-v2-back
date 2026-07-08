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
    delivery_cutoff_enabled?: boolean;
    delivery_cutoff_start_time?: string;
    delivery_cutoff_end_time?: string;
    delivery_cutoff_time?: string;
    imagen_header?: string;
     
    pedido?: Types.ObjectId[];  
    trabajador: Types.ObjectId[]; 
    ingreso?: Types.ObjectId[];  
    cierre_caja: Types.ObjectId[]; 
}
