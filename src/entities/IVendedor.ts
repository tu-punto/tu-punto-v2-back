import { IComprobanteEntrada } from "./IComprobanteEntrada";
import { IComprobantePago } from "./IComprobantePago";
import { IFlujoFinanciero } from "./IFlujoFinanciero";
import { IIngreso } from "./IIngreso";
import { IPedido } from "./IPedido";
import { IProducto } from "./IProducto";
import { ITrabajador } from "./ITrabajador";
import { IUser } from "./IUser";
import { IVenta } from "./IVenta";

export interface IVendedor {
    id_vendedor: number;
    marca: string;
    nombre: string;
    apellido: string;
    telefono: number;
    carnet: number;
    direccion: string;
    mail: string;
    alquiler: number;
    exhibicion: number;
    delivery: number;
    adelanto_servicio: number;
    comision_porcentual: number;
    comision_fija: number;
    fecha: Date;
    fecha_vigencia: Date;
    almacen_caja: number;
    deuda: number;
    emite_factura: boolean;
    //TODO QUITAR LOS NULLS DE ID_TRABAJADOR Y DE TRABAJADOR
    id_trabajador: number;

    user: IUser;
    comprobante_entrada?: IComprobanteEntrada[];
    comprobante_pago?: IComprobantePago[];
    trabajador: ITrabajador;
    pedido?: IPedido[];
    producto?: IProducto[];
    venta: IVenta[];
    flujoFinanciero?: IFlujoFinanciero[];
    ingreso?: IIngreso[];
}