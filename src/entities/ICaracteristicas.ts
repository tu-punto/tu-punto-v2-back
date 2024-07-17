import { ICaracteristicas_Producto } from "./ICaracteristicas_Producto";
import { IProducto } from "./IProducto";

export interface ICaracteristicas{
    id_Caracteristicas: number;
    nombre: string;

    caracteristicas_Producto: ICaracteristicas_Producto[];
}