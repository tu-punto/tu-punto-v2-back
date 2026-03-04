import { Types } from 'mongoose';

export type ExternalPaidStatus = "si" | "no";

export interface IVentaExterna {
    _id?: Types.ObjectId;

    carnet_vendedor: string;
    vendedor: string;
    telefono_vendedor?: string;
    numero_paquete: number;

    comprador: string;
    descripcion_paquete: string;
    telefono_comprador: string;
    fecha_pedido: Date;

    precio_paquete: number;
    precio_total: number;
    esta_pagado: ExternalPaidStatus;
    saldo_cobrar: number;
    estado_pedido: string;
    is_external?: boolean;
    delivered: boolean;

    hora_entrega_real?: Date;
    lugar_entrega?: string;

    // Legacy compatibility fields
    direccion_delivery?: string;
    ciudad_envio?: string;
    sucursal?: Types.ObjectId;
    nombre_flota?: string;
    precio_servicio?: number;
}
