import { Schema, model } from 'mongoose';
import { IGuiaEnvioDocument } from '../documents/IGuiaEnvioDocument';

const GuiaEnvioSchema = new Schema({
    vendedor: {
        type: Schema.Types.ObjectId,
        ref: 'Vendedor',
        required: true
    },
    sucursal: {
        type: Schema.Types.ObjectId,
        ref: 'Sucursal',
        required: true
    },
    descripcion: {
        type: String,
        maxlength: 200,
        default: ''
    },
    fecha_subida: {
        type: Date,
        default: Date.now
    },
    imagen_key: {
        type: String,
        required: false
    },
    isRecogido: {
        type: Boolean,
        default: false
    }
},{
    collection: 'GuiaEnvio',
    timestamps: false
})

export const GuiaEnviosModel = model<IGuiaEnvioDocument>('GuiaEnvio', GuiaEnvioSchema)