import { Types } from "mongoose";

export interface IPaqueteria {
  nombre: string;
  activo: boolean;
  codigo_guia: number;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
  tarifa_fija: number;
  multa_cada_dias: number;
  monto_multa: number;
  rutas_habilitadas?: Types.ObjectId[];
}
