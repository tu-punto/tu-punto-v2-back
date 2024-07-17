import { ICaracteristicas } from "./ICaracteristicas";
import { IProducto } from "./IProducto";

export interface ICaracteristicas_Producto{
    // Dos fk
    id_Caracteristica: number;
    id_Producto: number;

    value: string;

    caracteristicas: ICaracteristicas[];
    producto: IProducto[];
}