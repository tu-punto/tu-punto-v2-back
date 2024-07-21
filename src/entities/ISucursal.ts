import { IPedido } from "./IPedido";
import { IProducto_Sucursal } from "./IProducto_Sucursal";

export interface ISucursal{
    id_sucursal: number;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: number;
    id_trabajador: number;

    producto_sucursal?: IProducto_Sucursal[];
    pedido: IPedido;
}