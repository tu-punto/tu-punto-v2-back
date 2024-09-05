import { IProducto } from "./IProducto";
import { ISucursal } from "./ISucursal";
import { IVendedor } from "./IVendedor";

export interface IIngreso{
    id_ingreso: number;
    fecha_ingreso: Date;
    estado: string;
    cantidad_ingreso: number;
    id_producto: number;
    id_sucursal: number;
    id_vendedor: number;

    producto: IProducto;
    vendedor: IVendedor;
    sucursal: ISucursal;
}