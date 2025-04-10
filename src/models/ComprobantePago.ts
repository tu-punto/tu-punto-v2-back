/* import { IComprobantePago } from "../entities/IComprobantePago";
import { IVendedor } from "../entities/IVendedor";

export class ComprobantePago{
    id_comprobante_pago: number;
    fecha_emision: Date;
    hora_emision: Date;
    comprobante_entrada_pdf: string;
    total_ventas: number;
    total_adelantos: number;
    id_vendedor:number;

    vendedor: IVendedor;

    constructor(iComprobantePago: IComprobantePago){
        this.id_comprobante_pago= iComprobantePago.id_comprobante_pago;
        this.fecha_emision= iComprobantePago.fecha_emision;
        this.hora_emision= iComprobantePago.hora_emision;
        this.comprobante_entrada_pdf= iComprobantePago.comprobante_entrada_pdf;
        this.total_ventas= iComprobantePago.total_ventas;
        this.total_adelantos= iComprobantePago.total_adelantos;
        this.vendedor= iComprobantePago.vendedor;
        this.id_vendedor = iComprobantePago.id_vendedor;
    }
} */