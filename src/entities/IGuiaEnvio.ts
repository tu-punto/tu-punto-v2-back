import { Types } from 'mongoose';

export interface IGuiaEnvio {
    _id?: Types.ObjectId;

    vendedor: Types.ObjectId;
    sucursal: Types.ObjectId;
    descripcion?: string;
    fecha_subida: Date;
    imagen_key?: string;
    enviado_por_flota?: boolean;
    lista_productos_keys?: string[];
    observaciones?: string;
    isRecogido?: boolean;
    isRegistrado?: boolean;
}
