import { IPedido } from "./IPedido";
import { IProducto_Sucursal } from "./IProducto_Sucursal";

export interface ISucursal{
    id_Sucursal: number;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: number;
    id_Trabajador: number;

    producto_Sucursal?: IProducto_Sucursal[];
    pedido: IPedido;
}