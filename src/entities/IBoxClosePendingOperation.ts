import { Types } from "mongoose";

export interface IBoxClosePendingOperation {
  source_key: string;
  business_date: string;
  id_sucursal: Types.ObjectId;
  operation: {
    tipo: "ingreso" | "gasto" | "delivery" | "gasto_profit" | "pago_cliente";
    descripcion: string;
    concepto?: string;
    categoria?: string;
    cliente?: string;
    metodo: "efectivo" | "qr";
    monto: number;
    afecta_empresa?: boolean;
    fecha?: Date;
    id_vendedor?: Types.ObjectId;
    id_sucursal?: Types.ObjectId;
    finance_flux_id?: Types.ObjectId;
    source_key?: string;
    auto_generated?: boolean;
  };
  applied_at?: Date;
  applied_box_close_id?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}
