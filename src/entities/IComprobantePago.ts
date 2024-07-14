import { IVendedor } from "./IVendedor";

export interface IComprobantePago{
    id_Comprobante_Pago: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_entrada_pdf: string;
    total_ventas: number;
    total_adelantos: number;
    id_Vendedor:number;

    vendedor: IVendedor;
}