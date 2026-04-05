import { Types } from "mongoose";

export interface IRecurringExpense {
  tipo: string;
  detalle?: string;
  monto: number;
  id_sucursal?: Types.ObjectId | null;
  hasta_cuando_se_pago: Date;
  activo: boolean;
}
