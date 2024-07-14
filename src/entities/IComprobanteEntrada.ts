import { IVendedor } from "./IVendedor";

export interface IComprobanteEntrada{
    id_Comprobante_Entrada: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_pdf: string;
    id_Vendedor:number;

    vendedor: IVendedor;
}