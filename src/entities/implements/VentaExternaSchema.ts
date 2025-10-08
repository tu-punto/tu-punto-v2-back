import { Schema, model, Types } from 'mongoose';
import { IVentaExternaDocument } from '../documents/IVentaExternaDocument';

const VentaExternaSchema = new Schema({
    vendedor: {
        type: String,
        required: true
    },
    telefono_vendedor: {
        type: String,
        required: false
    },
    comprador: {
        type: String,
        required: true
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

    precio_total: {
        type: Number,
        required: true
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