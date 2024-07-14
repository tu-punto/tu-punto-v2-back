import { IProducto_Sucursal } from "./IProducto_Sucursal";

export interface IIngreso{
    id_Ingreso: number;
    fecha_Ingreso: Date;
    estado: string;

    producto_Sucursal?: IProducto_Sucursal[];
}