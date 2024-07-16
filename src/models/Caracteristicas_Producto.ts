import { ICaracteristicas } from "../entities/ICaracteristicas";
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";
import { IProducto } from "../entities/IProducto";

export class Caracteristicas_Producto{
    //las dos fk
    id_Caracteristicas: number;
    id_Producto: number;

    caracteristicas: ICaracteristicas[];
    producto: IProducto[];

    constructor(iCaracteristicas_Producto: ICaracteristicas_Producto){
        this.id_Caracteristicas = iCaracteristicas_Producto.id_Caracteristicas;
        this.id_Producto = iCaracteristicas_Producto.id_Producto;
        this.caracteristicas = iCaracteristicas_Producto.caracteristicas;
        this.producto = iCaracteristicas_Producto.producto;
    }
}