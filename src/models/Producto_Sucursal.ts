import { IIngreso } from "../entities/IIngreso";
import { IProducto } from "../entities/IProducto";
import { IProducto_Sucursal } from "../entities/IProducto_Sucursal";
import { ISucursal } from "../entities/ISucursal";

export class Producto_Sucursal{
     //dos afk
     id_producto: number;
     id_sucursal: number;
     cantidad_por_sucursal: number;
     numero_caja: number;
 
     producto: IProducto;
     sucursal: ISucursal;

     constructor(iProducto_Sucursal: IProducto_Sucursal){
          this.id_producto= iProducto_Sucursal.id_producto;
          this.id_sucursal= iProducto_Sucursal.id_sucursal;
          this.cantidad_por_sucursal= iProducto_Sucursal.cantidad_por_sucursal;
          this.numero_caja= iProducto_Sucursal.numero_caja;
          this.producto= iProducto_Sucursal.producto;
          this.sucursal= iProducto_Sucursal.sucursal;
     }
}