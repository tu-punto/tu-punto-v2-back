import { IComprobanteEntrada } from "../entities/IComprobanteEntrada";
import { IVendedor } from "../entities/IVendedor";

export class ComprobanteEntrada{
    id_Comprobante_Entrada: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_pdf: string;
    id_Vendedor:number;

    vendedor: IVendedor;

    constructor(iComprobanteEntrada: IComprobanteEntrada){
        this.id_Comprobante_Entrada= iComprobanteEntrada.id_Comprobante_Entrada;
        this.fecha_emision= iComprobanteEntrada.fecha_emision;
        this.hora_emision= iComprobanteEntrada.hora_emision;
        this.comprobante_pdf= iComprobanteEntrada.comprobante_pdf;
        this.vendedor= iComprobanteEntrada.vendedor;
        this.id_Vendedor= iComprobanteEntrada.id_Vendedor;
    }
}