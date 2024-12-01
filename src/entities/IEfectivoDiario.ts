import { CierreCajaEntity } from "./implements/CierreCajaEntity";

export interface IEfectivoDiario {
  id_efectivo_diario: number;
  valor: number;
  cantidad: number;
  total: number;
  created_at: Date;
  updated_at: Date;
  id_cierre_caja: CierreCajaEntity; 
}
