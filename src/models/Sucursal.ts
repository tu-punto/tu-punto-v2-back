import { IPedido } from "../entities/IPedido";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { ISucursal } from "../entities/ISucursal";

export class Sucursal{
    id_Sucursal: number;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: number;
    id_Trabajador: number;

    producto_Sucursal?: IProducto_Sucursal[];
    pedido: IPedido;

    constructor(iSucursal: ISucursal){
        this.id_Sucursal= iSucursal.id_Sucursal;
        this.nombre= iSucursal.nombre;
        this.direccion= iSucursal.direccion;
        this.ciudad= iSucursal.ciudad;
        this.telefono= iSucursal.telefono;
        this.id_Trabajador= iSucursal.id_Trabajador;
        this.producto_Sucursal= iSucursal.producto_Sucursal;
        this.pedido= iSucursal.pedido;
    }
}