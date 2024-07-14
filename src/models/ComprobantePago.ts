import { IComprobantePago } from "../entities/IComprobantePago";
import { IVendedor } from "../entities/IVendedor";

export class ComprobantePago{
    id_Comprobante_Pago: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_entrada_pdf: string;
    total_ventas: number;
    total_adelantos: number;
    id_Vendedor:number;

    vendedor: IVendedor;

    constructor(iComprobantePago: IComprobantePago){
        this.id_Comprobante_Pago= iComprobantePago.id_Comprobante_Pago;
        this.fecha_emision= iComprobantePago.fecha_emision;
        this.hora_emision= iComprobantePago.hora_emision;
        this.comprobante_entrada_pdf= iComprobantePago.comprobante_entrada_pdf;
        this.total_ventas= iComprobantePago.total_ventas;
        this.total_adelantos= iComprobantePago.total_adelantos;
        this.vendedor= iComprobantePago.vendedor;
        this.id_Vendedor = iComprobantePago.id_Vendedor;
    }
}