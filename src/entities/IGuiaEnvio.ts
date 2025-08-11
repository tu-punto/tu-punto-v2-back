import { Types } from 'mongoose';

export interface IGuiaEnvio {
    _id?: Types.ObjectId;

    vendedor: Types.ObjectId;
    descripcion?: string;
    fecha_subida: Date;
    imagen?: Buffer;
    tipoArchivo: "image/jpeg"|"image/png"|"image/webp";
    isRecogido?: boolean;
}