import { ICategoria } from "../entities/ICategoria";
import { IProducto } from "../entities/IProducto";

export class Categoria{
    id_categoria: number;
    categoria: string;

    producto?: IProducto[];

    constructor(iCategoria: ICategoria){
        this.id_categoria= iCategoria.id_categoria;
        this.categoria= iCategoria.categoria;
        this.producto= iCategoria.producto;
    }
}