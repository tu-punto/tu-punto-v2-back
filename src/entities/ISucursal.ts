import { IPedido } from "./IPedido";
import { IProducto_Sucursal } from "./IProducto_Sucursal";
import { ITrabajador } from "./ITrabajador";

export interface ISucursal{
    id_sucursal: number;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: number;
    
    producto_sucursal?: IProducto_Sucursal[];
    pedido?: IPedido;
    trabajador: ITrabajador[];
}