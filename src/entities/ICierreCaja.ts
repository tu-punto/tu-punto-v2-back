import { Types } from 'mongoose';

export interface ICierreCaja {
  id_cierre_caja: number;
  responsible: string;
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
  // Ahora hacemos referencia a los documentos de Mongoose mediante ObjectId
  id_efectivo_diario: Types.ObjectId;
  id_sucursal: Types.ObjectId;
}




