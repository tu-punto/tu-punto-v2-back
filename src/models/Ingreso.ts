import { IIngreso } from "../entities/IIngreso";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";

export class Ingreso{
    id_ingreso: number;
    fecha_ingreso: Date;
    estado: string;

    producto_sucursal?: IProducto_Sucursal[];

    constructor(iIngreso: IIngreso){
        this.id_ingreso= iIngreso.id_ingreso;
        this.fecha_ingreso= iIngreso.fecha_ingreso;
        this.estado= iIngreso.estado;
        this.producto_sucursal= iIngreso.producto_sucursal;
    }
}