import { IVendedor } from "./IVendedor";

export interface IComprobantePago{
    id_comprobante_pago: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_entrada_pdf: string;
    total_ventas: number;
    total_adelantos: number;
    id_vendedor:number;

    vendedor: IVendedor;
}