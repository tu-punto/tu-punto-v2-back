import { ICaracteristicas_Producto } from "./ICaracteristicas_Producto";
import { ICategoria } from "./ICategoria";
import { IProducto_Sucursal } from "./IProducto_Sucursal";
import { IVendedor } from "./IVendedor";
import { IVenta } from "./IVenta";

export interface IProducto{
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

}