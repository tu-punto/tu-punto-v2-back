import { IComprobanteEntrada } from "../entities/IComprobanteEntrada";
import { IVendedor } from "../entities/IVendedor";

export class ComprobanteEntrada{
    id_comprobante_entrada: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_pdf: string;
    id_vendedor:number;

    vendedor: IVendedor;

    constructor(iComprobanteEntrada: IComprobanteEntrada){
        this.id_comprobante_entrada= iComprobanteEntrada.id_comprobante_entrada;
        this.fecha_emision= iComprobanteEntrada.fecha_emision;
        this.hora_emision= iComprobanteEntrada.hora_emision;
        this.comprobante_pdf= iComprobanteEntrada.comprobante_pdf;
        this.vendedor= iComprobanteEntrada.vendedor;
        this.id_vendedor= iComprobanteEntrada.id_vendedor;
    }
}