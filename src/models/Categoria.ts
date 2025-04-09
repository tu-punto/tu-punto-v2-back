import { ICategoria } from "../entities/ICategoria";
import { IProducto } from "../entities/IProducto";

export class Categoria{
    id_categoria: number;
    categoria: string;

    producto?: IProducto[];

    constructor(iCategoria: ICategoria) {
        this.id_categoria = iCategoria.id_categoria;
        this.categoria = iCategoria.categoria;
      
        if (
          iCategoria.producto &&
          typeof iCategoria.producto[0] === "object" &&
          "nombre_producto" in iCategoria.producto[0]
        ) {
          this.producto = iCategoria.producto as IProducto[];
        } else {
          this.producto = undefined; 
        }
      }
      
}