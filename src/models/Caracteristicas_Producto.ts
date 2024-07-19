import { ICaracteristicas } from "../entities/ICaracteristicas";
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";
import { CaracteristicasEntity } from "../entities/implements/CaracteristicasEntity";
import { ProductoEntity } from "../entities/implements/ProductoEntity";
import { IProducto } from "../entities/IProducto";

export class Caracteristicas_Producto{
    

    caracteristicaProductoId: number
    value: string;
    caracteristica: CaracteristicasEntity
    producto: ProductoEntity

    constructor(iCaracteristicas_Producto: ICaracteristicas_Producto){
        this.caracteristicaProductoId = iCaracteristicas_Producto.caracteristicaProductoId
        this.caracteristica = iCaracteristicas_Producto.caracteristica;
        this.producto = iCaracteristicas_Producto.producto;
        this.value = iCaracteristicas_Producto.value
    }
}