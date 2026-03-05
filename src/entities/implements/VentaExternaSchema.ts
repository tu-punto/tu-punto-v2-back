import { Schema, model, Types } from 'mongoose';
import { IVentaExternaDocument } from '../documents/IVentaExternaDocument';

const VentaExternaSchema = new Schema({
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

    precio_total: {
        type: Number,
        required: true
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
    }
}, {
    collection: 'VentaExterna',
    timestamps: false
})

export const VentaExternaModel = model<IVentaExternaDocument>('VentaExterna', VentaExternaSchema)
