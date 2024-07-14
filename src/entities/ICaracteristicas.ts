import { ICaracteristicas_Producto } from "./ICaracteristicas_Producto";
import { IProducto } from "./IProducto";

export interface ICaracteristicas{
    id_Caracteristicas: number;
    nombre: string;
    valor: string;
    id_Producto: number;

    caracteristicas_Producto: ICaracteristicas_Producto;
}