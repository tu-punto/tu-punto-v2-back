import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";

export interface IFlujoFinanciero {
    id_flujo_financiero: number;
    tipo: string;
    categoria: string;
    concepto: string;
    monto: number;
    fecha: Date;
    esDeuda: boolean;

    vendedor: IVendedor;
    trabajador: ITrabajador;
}