import { IIngreso } from "./IIngreso";
import { IProducto } from "./IProducto";
import { ISucursal } from "./ISucursal";

export interface IProducto_Sucursal{
    //las dos primeras afk
    id_Producto: number;
    id_Sucursal: number;
    id_Ingreso: number;
    cantidad_Por_Sucursal: number;
    numero_Caja: number;

    producto: IProducto;
    sucursal: ISucursal;
    ingreso?: IIngreso[];
}