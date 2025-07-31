import { Types } from 'mongoose';

export interface IFinanceFlux {
  tipo: "INGRESO" | "GASTO" | "INVERSION";
  monto: number;
  fecha: Date;
  categoria?: string;
  concepto?: string;
  comentario?: string;
  esDeuda?: boolean;
  id_vendedor?: Types.ObjectId;
}