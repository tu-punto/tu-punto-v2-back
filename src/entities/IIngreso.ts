import { Types } from 'mongoose';

export interface IIngreso {
  fecha_ingreso: Date;
  estado: string;
  cantidad_ingreso: number;
  nombre_variante: string;
  producto: Types.ObjectId;
  sucursal: Types.ObjectId;
  vendedor: Types.ObjectId;
  combinacion: Record<string, string>; 
}
