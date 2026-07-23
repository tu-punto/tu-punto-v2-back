import { Types } from 'mongoose';

export interface IComprobantePago {
  id_comprobante_pago: number;
  fecha_emision: Date;
  hora_emision: Date;
  comprobante_entrada_pdf: string;
  metodo_pago: "efectivo" | "qr";
  monto_pagado: number;
  total_ventas: number;
  total_adelantos: number;
  total_deliverys: number;
  total_mensualidades: number;
  id_vendedor: number;

  vendedor: Types.ObjectId; 
}
