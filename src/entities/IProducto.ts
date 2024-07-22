import { ICaracteristicas } from "./ICaracteristicas";
import { ICategoria } from "./ICategoria";
import { IProducto_Sucursal } from "./IProducto_Sucursal";
import { IVendedor } from "./IVendedor";
import { IVenta } from "./IVenta";

export interface IProducto{
    id_producto: number;
    nombre_producto: string;
    precio: number;
    fecha_de_ingreso: Date;
    imagen: string;
    id_categoria: number;
    id_vendedor: number;

    vendedor: IVendedor;
    features: ICaracteristicas[];
    categoria: ICategoria;
    venta: IVenta[];
    producto_sucursal?: IProducto_Sucursal[];

}