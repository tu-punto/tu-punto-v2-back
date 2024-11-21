import { EfectivoDiarioEntity } from "./implements/EfectivoDiarioEntity";

export interface ICierreCaja {
  id_cierre_caja: number;
  responsible: string;
  ventas_efectivo: number;
  ventas_qr: number;
  efectivo_inicial: number;
  ingresos_efectivo: number;
  efectivo_esperado: number;
  efectivo_real: number;
  diferencia: number;
  created_at: Date;
  updated_at: Date;
  id_efectivo_diario: EfectivoDiarioEntity;
}
