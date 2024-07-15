import { IComprobanteEntrada } from "./IComprobanteEntrada";
import { IComprobantePago } from "./IComprobantePago";
import { IPedido } from "./IPedido";
import { IProducto } from "./IProducto";
import { ITrabajador } from "./ITrabajador";

export interface IVendedor{
    id_Vendedor: number;
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
    //TODO QUITAR LOS NULLS DE ID_TRABAJADOR Y DE TRABAJADOR
    id_Trabajador: number;

    comprobante_Entrada?:IComprobanteEntrada[];
    comprobante_Pago?:IComprobantePago[];
    trabajador: ITrabajador;
    pedido?: IPedido[];
    producto?: IProducto[];
}