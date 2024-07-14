import { ICategoria } from "../entities/ICategoria";
import { IProducto } from "../entities/IProducto";

export class Categoria{
    id_Categoria: number;
    categoria: string;

    producto?: IProducto[];

    constructor(iCategoria: ICategoria){
        this.id_Categoria= iCategoria.id_Categoria;
        this.categoria= iCategoria.categoria;
        this.producto= iCategoria.producto;
    }
}