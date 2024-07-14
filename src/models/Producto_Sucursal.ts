import { IIngreso } from "../entities/IIngreso";
import { IProducto } from "../entities/IProducto";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { ISucursal } from "../entities/ISucursal";

export class Producto_Sucursal{
     //dos afk
     id_Producto: number;
     id_Sucursal: number;
     id_Ingreso: number;
     cantidad_Por_Sucursal: number;
     numero_Caja: number;
 
     producto: IProducto;
     sucursal: ISucursal;
     ingreso?: IIngreso[];

     constructor(iProducto_Sucursal: IProducto_Sucursal){
          this.id_Producto= iProducto_Sucursal.id_Producto;
          this.id_Sucursal= iProducto_Sucursal.id_Sucursal;
          this.id_Ingreso= iProducto_Sucursal.id_Ingreso;
          this.cantidad_Por_Sucursal= iProducto_Sucursal.cantidad_Por_Sucursal;
          this.numero_Caja= iProducto_Sucursal.numero_Caja;
          this.producto= iProducto_Sucursal.producto;
          this.sucursal= iProducto_Sucursal.sucursal;
          this.ingreso= iProducto_Sucursal.ingreso;
     }
}