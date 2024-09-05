import { IIngreso } from "../entities/IIngreso";
import { IProducto } from "../entities/IProducto";
import { IVendedor } from "../entities/IVendedor";
import { ISucursal } from '../entities/ISucursal';

export class Ingreso{
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


    constructor(iIngreso: IIngreso){
        this.id_ingreso= iIngreso.id_ingreso;
        this.fecha_ingreso= iIngreso.fecha_ingreso;
        this.estado= iIngreso.estado;
        this.producto = iIngreso.producto;
        this.vendedor = iIngreso.vendedor;
        this.sucursal = iIngreso.sucursal;
        this.cantidad_ingreso = iIngreso.cantidad_ingreso;
        this.id_producto = iIngreso.id_producto;
        this.id_sucursal = iIngreso.id_sucursal;
        this.id_vendedor = iIngreso.id_vendedor;

    }
}