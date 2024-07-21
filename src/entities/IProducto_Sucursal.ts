import { IIngreso } from "./IIngreso";
import { IProducto } from "./IProducto";
import { ISucursal } from "./ISucursal";

export interface IProducto_Sucursal{
    //las dos primeras afk
    id_producto: number;
    id_sucursal: number;
    id_ingreso: number;
    cantidad_por_sucursal: number;
    numero_caja: number;

    producto: IProducto;
    sucursal: ISucursal;
    ingreso?: IIngreso[];
}