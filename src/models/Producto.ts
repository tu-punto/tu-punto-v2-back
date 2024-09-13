import { IProducto } from './../entities/IProducto';
import { ICategoria } from "../entities/ICategoria";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";
import { ICaracteristicas } from '../entities/ICaracteristicas';
import { IGroup } from '../entities/IGroup';
import { IIngreso } from '../entities/IIngreso';

export class Producto{
    id_producto: number;
    nombre_producto: string;
    precio: number;
    fecha_de_ingreso: Date;
    imagen: string;
    id_categoria: number;
    id_vendedor: number;

    vendedor: IVendedor;
    features: ICaracteristicas[]
    categoria: ICategoria;
    venta: IVenta[];
    producto_sucursal?: IProducto_Sucursal[];
    ingreso?: IIngreso[];
    group: IGroup

    constructor(iProducto: IProducto){
        this.id_producto= iProducto.id_producto;
        this.nombre_producto= iProducto.nombre_producto;
        this.precio= iProducto.precio;
        this.fecha_de_ingreso= iProducto.fecha_de_ingreso;
        this.imagen= iProducto.imagen;
        this.id_categoria= iProducto.id_categoria;
        this.id_vendedor= iProducto.id_vendedor;
        this.vendedor= iProducto.vendedor;
        this.features = iProducto.features
        this.categoria= iProducto.categoria;
        this.venta= iProducto.venta;
        this.producto_sucursal= iProducto.producto_sucursal; 
        this.group = iProducto.group
        this.ingreso = iProducto.ingreso;
    }
}