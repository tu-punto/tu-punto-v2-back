import { IProducto } from "./IProducto";

export interface ICategoria{
    id_Categoria: number;
    categoria: string;

    producto?: IProducto[];
}