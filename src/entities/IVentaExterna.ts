import { Types } from 'mongoose';

export interface IVentaExterna {
    _id?: Types.ObjectId;

    vendedor: string;
    telefono_vendedor?: string;
    comprador: string;
    telefono_comprador?: string;
    fecha_pedido: Date;

    direccion_delivery?: string;
    ciudad_envio?: string;
    sucursal?: Types.ObjectId;
    nombre_flota?: string;
    precio_servicio?: number;
    precio_total: number;

    delivered: boolean;
}