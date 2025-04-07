import { Types } from 'mongoose';

export interface IComprobanteEntrada {
  id_comprobante_entrada: number;
  fecha_emision: Date;
  hora_emision: Date;
  comprobante_pdf: string;
  id_vendedor: number;

  vendedor: Types.ObjectId; 
}
