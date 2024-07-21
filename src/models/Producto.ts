import { IProducto } from './../entities/IProducto';
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";
import { ICategoria } from "../entities/ICategoria";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";

export class Producto{
    id_producto: number;
    nombre_producto: string;
    precio: number;
    fecha_de_ingreso: Date;
    imagen: string;
    id_categoria: number;
    id_vendedor: number;

    vendedor: IVendedor;
    caracteristicas_producto: ICaracteristicas_Producto[];
    categoria: ICategoria;
    venta: IVenta[];
    producto_sucursal?: IProducto_Sucursal[];

    constructor(iProducto: IProducto){
        this.id_producto= iProducto.id_producto;
        this.nombre_producto= iProducto.nombre_producto;
        this.precio= iProducto.precio;
        this.fecha_de_ingreso= iProducto.fecha_de_ingreso;
        this.imagen= iProducto.imagen;
        this.id_categoria= iProducto.id_categoria;
        this.id_vendedor= iProducto.id_vendedor;
        this.vendedor= iProducto.vendedor;
        this.caracteristicas_producto= iProducto.caracteristicas_producto;
        this.categoria= iProducto.categoria;
        this.venta= iProducto.venta;
        this.producto_sucursal= iProducto.producto_sucursal; 
    }
}