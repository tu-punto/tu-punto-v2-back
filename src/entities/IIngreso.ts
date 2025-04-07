
import { Types } from 'mongoose';
export interface IIngreso{
    id_ingreso: number;
    fecha_ingreso: Date;
    estado: string;
    cantidad_ingreso: number;
    id_producto: number;
    id_sucursal: number;
    id_vendedor: number;

    producto: Types.ObjectId;
    vendedor: Types.ObjectId;
    sucursal: Types.ObjectId;
}