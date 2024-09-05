import { IIngreso } from "../entities/IIngreso";
import { IPedido } from "../entities/IPedido";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { ISucursal } from "../entities/ISucursal";
import { ITrabajador } from "../entities/ITrabajador";

export class Sucursal{
    id_sucursal: number;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: number;

    producto_sucursal?: IProducto_Sucursal[];
    pedido?: IPedido;
    trabajador: ITrabajador[];
    ingreso?: IIngreso[];

    constructor(iSucursal: ISucursal){
        this.id_sucursal= iSucursal.id_sucursal;
        this.nombre= iSucursal.nombre;
        this.direccion= iSucursal.direccion;
        this.ciudad= iSucursal.ciudad;
        this.telefono= iSucursal.telefono;
        this.producto_sucursal= iSucursal.producto_sucursal;
        this.pedido= iSucursal.pedido;
        this.trabajador= iSucursal.trabajador;
        this.ingreso = iSucursal.ingreso;
    }
}