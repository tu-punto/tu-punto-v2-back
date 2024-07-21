import { ICaracteristicas } from "../entities/ICaracteristicas";
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasEntity";
import { ProductoEntity } from "../entities/implements/ProductoEntity";
import { IProducto } from "../entities/IProducto";

export class Caracteristicas_Producto{
    caracteristica_producto_id: number
    value: string;
    caracteristica: CaracteristicasEntity
    producto: ProductoEntity

    constructor(iCaracteristicas_Producto: ICaracteristicas_Producto){
        this.caracteristica_producto_id = iCaracteristicas_Producto.caracteristica_producto_id
        this.caracteristica = iCaracteristicas_Producto.caracteristica;
        this.producto = iCaracteristicas_Producto.producto;
        this.value = iCaracteristicas_Producto.value
    }
}