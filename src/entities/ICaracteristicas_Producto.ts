import { ICaracteristicas } from "./ICaracteristicas";
import { CaracteristicasEntity } from "./implements/CaracteristicasEntity";
import { ProductoEntity } from "./implements/ProductoEntity";
import { IProducto } from "./IProducto";

export interface ICaracteristicas_Producto{
    caracteristica_producto_id: number
    value: string;
    caracteristica: CaracteristicasEntity
    producto: ProductoEntity
}