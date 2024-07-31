import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { ITrabajador } from "../entities/ITrabajador";
import { IVendedor } from "../entities/IVendedor";

export class FlujoFinanciero {
    id_flujo_financiero: number;
    tipo: string;
    categoria: string;
    concepto: string;
    monto: number;
    fecha: Date;
    vendedor: IVendedor;
    trabajador: ITrabajador;

    constructor(iFlujoFinanciero: IFlujoFinanciero) {
        this.id_flujo_financiero = iFlujoFinanciero.id_flujo_financiero
        this.tipo = iFlujoFinanciero.tipo
        this.categoria = iFlujoFinanciero.categoria
        this.concepto = iFlujoFinanciero.concepto
        this.monto = iFlujoFinanciero.monto
        this.fecha = iFlujoFinanciero.fecha
        this.vendedor = iFlujoFinanciero.vendedor
        this.trabajador = iFlujoFinanciero.trabajador
    }
}