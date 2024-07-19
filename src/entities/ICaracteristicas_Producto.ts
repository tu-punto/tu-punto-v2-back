import { ICaracteristicas } from "./ICaracteristicas";
import { CaracteristicasEntity } from "./implements/CaracteristicasEntity";
import { ProductoEntity } from "./implements/ProductoEntity";
import { IProducto } from "./IProducto";

export interface ICaracteristicas_Producto{
    caracteristicaProductoId: number
    value: string;
    caracteristica: CaracteristicasEntity
    producto: ProductoEntity
}