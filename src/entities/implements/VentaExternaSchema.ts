import { Schema, model, Types } from 'mongoose';
import { IVentaExternaDocument } from '../documents/IVentaExternaDocument';

const VentaExternaSchema = new Schema({
    id_vendedor: {
        type: Types.ObjectId,
        ref: 'Vendedor',
        required: false
    },
    carnet_vendedor: {
        type: String,
        required: true,
        trim: true
    },
    vendedor: {
        type: String,
        required: true,
        trim: true
    },
    telefono_vendedor: {
        type: String,
        required: false
    },
    numero_paquete: {
        type: Number,
        required: true,
        default: 1
    },
    comprador: {
        type: String,
        required: false,
        trim: true
    },
    descripcion_paquete: {
        type: String,
        required: true,
        trim: true
    },
    telefono_comprador: {
        type: String,
        required: false
    },
    fecha_pedido: {
        type: Date,
        required: true
    },
    service_origin: {
        type: String,
        enum: ["external", "simple_package"],
        default: "external"
    },
    package_size: {
        type: String,
        enum: ["estandar", "grande"],
        default: "estandar"
    },
    precio_paquete_unitario: {
        type: Number,
        required: false,
        default: 0
    },
    amortizacion_vendedor: {
        type: Number,
        required: false,
        default: 0
    },
    deuda_comprador: {
        type: Number,
        required: false,
        default: 0
    },
    saldo_por_paquete: {
        type: Number,
        required: false,
        default: 0
    },
    metodo_pago: {
        type: String,
        enum: ["", "efectivo", "qr"],
        default: ""
    },
    direccion_delivery: {
        type: String,
        required: false
    },
    ciudad_envio: {
        type: String,
        required: false
    },
    sucursal: {
        type: Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: false
    },
    origen_sucursal: {
        type: Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: false
    },
    destino_sucursal: {
        type: Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: false
    },
    nombre_flota: {
        type: String,
        required: false
    },
    precio_servicio:{
        type: Number,
        required:false,
        default: 0
    },
    precio_paquete: {
        type: Number,
        required: true,
        default: 0
    },
    precio_entre_sucursal: {
        type: Number,
        required: false,
        default: 0
    },

    precio_total: {
        type: Number,
        required: true
    },
    cargo_delivery: {
        type: Number,
        required: false,
        default: 0
    },
    costo_delivery: {
        type: Number,
        required: false,
        default: 0
    },
    esta_pagado: {
        type: String,
        enum: ["si", "no", "mixto"],
        default: "no",
    },
    monto_paga_vendedor: {
        type: Number,
        default: 0,
    },
    monto_paga_comprador: {
        type: Number,
        default: 0,
    },
    saldo_cobrar: {
        type: Number,
        default: 0,
    },
    estado_pedido: {
        type: String,
        default: "En Espera",
    },
    hora_entrega_real: {
        type: Date,
        required: false
    },
    lugar_entrega: {
        type: String,
        default: "Externo"
    },
    is_external: {
        type: Boolean,
        default: true
    },

    delivered: {
        type: Boolean,
        default: false,
    },
    seller_balance_applied: {
        type: Boolean,
        default: false,
    },
    deposito_realizado: {
        type: Boolean,
        default: false,
    }
}, {
    collection: 'VentaExterna',
    timestamps: false
})

export const VentaExternaModel = model<IVentaExternaDocument>('VentaExterna', VentaExternaSchema)
