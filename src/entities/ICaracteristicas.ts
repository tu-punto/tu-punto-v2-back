
import { IProducto } from "./IProducto";

export interface ICaracteristicas{
    id_caracteristicas: number;
    feature: string;
    value: string;
    product: IProducto
}