import { Schema, model } from 'mongoose';
import { IGuiaEnvioDocument } from '../documents/IGuiaEnvioDocument';

const GuiaEnvioSchema = new Schema({
    vendedor: {
        type: Schema.Types.ObjectId,
        ref: 'Vendedor',
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
    imagen: {
        type: Buffer,
        required: false
    },
    tipoArchivo: {
        type: String,
        required: false,
        enum: ['image/jpeg', 'image/png', 'image/webp']
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