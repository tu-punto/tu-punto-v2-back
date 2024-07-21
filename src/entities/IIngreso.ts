import { IProducto_Sucursal } from "./IProducto_Sucursal";

export interface IIngreso{
    id_ingreso: number;
    fecha_ingreso: Date;
    estado: string;

    producto_sucursal?: IProducto_Sucursal[];
}