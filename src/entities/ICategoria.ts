import { IProducto } from "./IProducto";

export interface ICategoria{
    id_categoria: number;
    categoria: string;

    producto?: IProducto[];
}