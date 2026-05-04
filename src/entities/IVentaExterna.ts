import { Types } from 'mongoose';

export type ExternalPaidStatus = "si" | "no" | "mixto";
export type ExternalServiceOrigin = "external" | "simple_package";
export type PackageSize = "estandar" | "grande";
export type PackagePaymentMethod = "" | "efectivo" | "qr";

export interface IVentaExterna {
    _id?: Types.ObjectId;

    id_vendedor?: Types.ObjectId;
    carnet_vendedor: string;
    vendedor: string;
    telefono_vendedor?: string;
    numero_paquete: number;

    comprador?: string;
    descripcion_paquete: string;
    telefono_comprador?: string;
    fecha_pedido: Date;

    service_origin?: ExternalServiceOrigin;
    package_size?: PackageSize;
    precio_paquete_unitario?: number;
    amortizacion_vendedor?: number;
    deuda_comprador?: number;
    saldo_por_paquete?: number;
    metodo_pago?: PackagePaymentMethod;
    tipo_de_pago?: string;
    subtotal_qr?: number;
    subtotal_efectivo?: number;
    precio_paquete: number;
    precio_entre_sucursal?: number;
    precio_total: number;
    cargo_delivery?: number;
    costo_delivery?: number;
    esta_pagado: ExternalPaidStatus;
    monto_paga_vendedor?: number;
    monto_paga_comprador?: number;
    saldo_cobrar: number;
    estado_pedido: string;
    is_external?: boolean;
    delivered: boolean;
    seller_balance_applied?: boolean;
    deposito_realizado?: boolean;
    seller_debt_applied?: boolean;
    pedido_ref?: Types.ObjectId;
    qr_code?: string;
    shipping_qr_code?: string;
    shipping_qr_payload?: string;
    shipping_qr_image_path?: string;
    qr_impreso?: boolean;
    qr_impreso_at?: Date;
    numero_guia?: string;
    guia_sequence?: number;

    hora_entrega_real?: Date;
    lugar_entrega?: string;

    // Legacy compatibility fields
    direccion_delivery?: string;
    ciudad_envio?: string;
    sucursal?: Types.ObjectId;
    origen_sucursal?: Types.ObjectId;
    destino_sucursal?: Types.ObjectId;
    nombre_flota?: string;
    precio_servicio?: number;
}
