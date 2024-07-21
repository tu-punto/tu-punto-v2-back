import { ICaracteristicas_Producto } from "./ICaracteristicas_Producto";
import { IProducto } from "./IProducto";

export interface ICaracteristicas{
    id_caracteristicas: number;
    nombre: string;

    caracteristicas_producto: ICaracteristicas_Producto[];
}