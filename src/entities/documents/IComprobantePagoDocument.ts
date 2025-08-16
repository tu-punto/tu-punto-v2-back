import { Document, Types } from 'mongoose';

export interface IComprobantePagoDocument extends Document {
  fecha_emision: Date;
  hora_emision: Date;
  comprobante_pago_pdf: Buffer;
  total_ventas: number;
  total_adelantos: number;
  total_deliverys: number;
  total_mensualidades: number;
  monto_pagado: number;
  filename: string;
  vendedor: Types.ObjectId;
}
