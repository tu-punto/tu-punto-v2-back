import { Types } from "mongoose";

export interface ICierreCaja {
  responsable: {
    id: Types.ObjectId;
    nombre: string;
  };
  ventas_efectivo: number;
  ventas_qr: number;
  efectivo_inicial: number;
  bancario_inicial: number;
  ingresos_efectivo: number;
  efectivo_esperado: number;
  efectivo_real: number;
  bancario_esperado: number;
  bancario_real: number;
  diferencia_efectivo: number;
  diferencia_bancario: number;
  observaciones: string;
  created_at: Date;
  updated_at: Date;

  efectivo_diario: {
    corte: number;
    cantidad: number;
  }[];

  id_sucursal: Types.ObjectId;
}
