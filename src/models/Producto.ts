import { IProducto } from './../entities/IProducto';
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";
import { ICategoria } from "../entities/ICategoria";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";

export class Producto{
    id_Producto: number;
    nombre_producto: string;
    precio: number;
    fecha_De_Ingreso: Date;
    imagen: string;
    id_Categoria: number;
    id_Caracteristicas: number;
    id_Vendedor: number;

    vendedor: IVendedor;
    caracteristicas_producto: ICaracteristicas_Producto;
    categoria: ICategoria;
    venta: IVenta[];
    producto_Sucursal?: IProducto_Sucursal[];

    constructor(iProducto: IProducto){
        this.id_Producto= iProducto.id_Producto;
        this.nombre_producto= iProducto.nombre_producto;
        this.precio= iProducto.precio;
        this.fecha_De_Ingreso= iProducto.fecha_De_Ingreso;
        this.imagen= iProducto.imagen;
        this.id_Categoria= iProducto.id_Categoria;
        this.id_Caracteristicas= iProducto.id_Caracteristicas;
        this.id_Vendedor= iProducto.id_Vendedor;
        this.vendedor= iProducto.vendedor;
        this.caracteristicas_producto= iProducto.caracteristicas_producto;
        this.categoria= iProducto.categoria;
        this.venta= iProducto.venta;
        this.producto_Sucursal= iProducto.producto_Sucursal; 
    }
}