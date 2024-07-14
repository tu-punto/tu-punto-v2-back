import { IIngreso } from "../entities/IIngreso";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";

export class Ingreso{
    id_Ingreso: number;
    fecha_Ingreso: Date;
    estado: string;

    producto_Sucursal?: IProducto_Sucursal[];

    constructor(iIngreso: IIngreso){
        this.id_Ingreso= iIngreso.id_Ingreso;
        this.fecha_Ingreso= iIngreso.fecha_Ingreso;
        this.estado= iIngreso.estado;
        this.producto_Sucursal= iIngreso.producto_Sucursal;
    }
}